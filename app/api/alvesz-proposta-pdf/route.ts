import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceContext } from "@/lib/supabase/services/context";
import {
  ALVESZ_PDF_BUCKET,
  ALVESZ_PDF_SIGNED_URL_TTL_SECONDS,
  buildAlveszPdfStoragePath,
} from "@/lib/workspace/alvesz-pdf-storage";
import type { Json } from "@/types/database";
import type { AlveszPropostaPdfMeta } from "@/utils/alvesz-proposta";
import { parseRequestJson } from "@/utils/safe-json";

function toPdfMetaJson(meta: AlveszPropostaPdfMeta): Json {
  return meta as unknown as Json;
}

function decodeBase64Pdf(base64: string): Uint8Array {
  const raw = base64.includes(",") ? base64.split(",")[1]! : base64;
  const buf = Buffer.from(raw, "base64");
  return new Uint8Array(buf);
}

export async function POST(req: Request) {
  try {
    let ctx;
    try {
      ctx = await requireWorkspaceContext();
    } catch (err) {
      const code = err instanceof Error ? err.message : "auth";
      if (code === "workspace_required" || code === "workspace_access_denied") {
        return Response.json(
          { error: "Workspace ativo necessário para publicar proposta." },
          { status: 403 }
        );
      }
      return Response.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { supabase, userId, activeWorkspaceId } = ctx;

    const { data: body, error: bodyError } = await parseRequestJson<{
      orcamento_id?: string;
      proposta_id?: string;
      conteudo?: string;
      melhorada_ia?: boolean;
      pdf_base64?: string;
      pdf_meta?: AlveszPropostaPdfMeta;
      /** Ignored — path is always server-built to prevent cross-workspace writes. */
      storage_path?: string;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    if (body.storage_path?.trim()) {
      return Response.json(
        { error: "storage_path não pode ser escolhido pelo cliente." },
        { status: 400 }
      );
    }

    const orcamentoId = body.orcamento_id?.trim();
    const pdfBase64 = body.pdf_base64?.trim();
    const conteudo = body.conteudo?.trim();

    if (!orcamentoId || !pdfBase64 || !conteudo) {
      return Response.json(
        { error: "orcamento_id, pdf_base64 e conteudo são obrigatórios." },
        { status: 400 }
      );
    }

    // IDOR: orçamento must belong to the validated workspace
    const { data: orcamento, error: orcamentoError } = await supabase
      .from("orcamentos")
      .select("id")
      .eq("id", orcamentoId)
      .eq("workspace_id", activeWorkspaceId)
      .maybeSingle();

    if (orcamentoError || !orcamento) {
      return Response.json({ error: "Orçamento não encontrado neste workspace." }, { status: 404 });
    }

    const pdfBytes = decodeBase64Pdf(pdfBase64);
    if (pdfBytes.length < 100) {
      return Response.json({ error: "PDF inválido." }, { status: 400 });
    }

    const pdfMeta = (body.pdf_meta ?? {}) as AlveszPropostaPdfMeta;
    const version = pdfMeta.version ?? 1;
    let savedPropostaId = body.proposta_id?.trim() || null;

    if (savedPropostaId) {
      const { data: existing, error: existingError } = await supabase
        .from("alvesz_propostas")
        .select("id")
        .eq("id", savedPropostaId)
        .eq("workspace_id", activeWorkspaceId)
        .maybeSingle();

      if (existingError || !existing) {
        return Response.json({ error: "Proposta não encontrada neste workspace." }, { status: 404 });
      }

      const { error: updateError } = await supabase
        .from("alvesz_propostas")
        .update({
          conteudo,
          melhorada_ia: Boolean(body.melhorada_ia),
        })
        .eq("id", savedPropostaId)
        .eq("workspace_id", activeWorkspaceId);

      if (updateError) {
        return Response.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("alvesz_propostas")
        .insert({
          user_id: userId,
          workspace_id: activeWorkspaceId,
          orcamento_id: orcamentoId,
          conteudo,
          melhorada_ia: Boolean(body.melhorada_ia),
          pdf_meta: toPdfMetaJson({ ready: false, version }),
        })
        .select("id")
        .single();

      if (insertError || !inserted?.id) {
        return Response.json(
          { error: insertError?.message ?? "Falha ao criar proposta." },
          { status: 500 }
        );
      }
      savedPropostaId = inserted.id;
    }

    let storagePath: string;
    try {
      storagePath = buildAlveszPdfStoragePath({
        workspaceId: activeWorkspaceId,
        proposalId: savedPropostaId,
        version,
      });
    } catch {
      return Response.json({ error: "IDs inválidos para path de storage." }, { status: 400 });
    }

    const { error: uploadError } = await supabase.storage
      .from(ALVESZ_PDF_BUCKET)
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("[alvesz-proposta-pdf] upload", uploadError);
      return Response.json(
        { error: "Não foi possível salvar o PDF. Verifique o bucket alvesz-pdfs." },
        { status: 500 }
      );
    }

    const origin = new URL(req.url).origin;
    const apiPdfUrl = `${origin}/api/alvesz-proposta-pdf/${savedPropostaId}`;

    const { data: signed, error: signedError } = await supabase.storage
      .from(ALVESZ_PDF_BUCKET)
      .createSignedUrl(storagePath, ALVESZ_PDF_SIGNED_URL_TTL_SECONDS);

    if (signedError) {
      console.error("[alvesz-proposta-pdf] signedUrl", signedError);
    }

    const signedUrl = signed?.signedUrl ?? null;

    const finalMeta: AlveszPropostaPdfMeta = {
      ...pdfMeta,
      ready: true,
      version,
      exportedAt: pdfMeta.exportedAt ?? new Date().toISOString(),
      // Prefer authenticated API URL over permanent public storage URLs
      pdfUrl: apiPdfUrl,
      storagePath,
      propostaId: savedPropostaId,
      templateId: pdfMeta.templateId ?? "alvesz-premium-v1",
    };

    await supabase
      .from("alvesz_propostas")
      .update({ pdf_meta: toPdfMetaJson(finalMeta) })
      .eq("id", savedPropostaId)
      .eq("workspace_id", activeWorkspaceId);

    return Response.json({
      propostaId: savedPropostaId,
      pdfUrl: apiPdfUrl,
      signedUrl,
      signedUrlExpiresIn: ALVESZ_PDF_SIGNED_URL_TTL_SECONDS,
      apiPdfUrl,
      pdf_meta: finalMeta,
    });
  } catch (error) {
    console.error("[alvesz-proposta-pdf]", error);
    return Response.json({ error: "Erro ao publicar PDF." }, { status: 500 });
  }
}
