import { createClient } from "@/lib/supabase/server";
import {
  ALVESZ_PDF_BUCKET,
  ALVESZ_PDF_SIGNED_URL_TTL_SECONDS,
  assertAlveszPdfPathAllowed,
  isCanonicalAlveszPdfPath,
} from "@/lib/workspace/alvesz-pdf-storage";
import type { Json } from "@/types/database";
import type { AlveszPropostaPdfMeta } from "@/utils/alvesz-proposta";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id?.trim()) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Não autenticado." }, { status: 401 });
    }

    // RLS enforces workspace membership — peers in the same workspace OK.
    const { data: proposta, error } = await supabase
      .from("alvesz_propostas")
      .select("id, user_id, workspace_id, pdf_meta")
      .eq("id", id.trim())
      .maybeSingle();

    if (error || !proposta) {
      return Response.json({ error: "Proposta não encontrada." }, { status: 404 });
    }

    const meta = proposta.pdf_meta as AlveszPropostaPdfMeta | null;
    const storagePath = meta?.storagePath;

    if (!storagePath) {
      return Response.json({ error: "PDF não disponível." }, { status: 404 });
    }

    // Canonical paths must match the proposta's workspace + id (anti path-swap).
    if (isCanonicalAlveszPdfPath(storagePath)) {
      const allowed = assertAlveszPdfPathAllowed({
        storagePath,
        workspaceId: proposta.workspace_id,
        proposalId: proposta.id,
      });
      if (!allowed.ok) {
        return Response.json({ error: "Path de PDF inconsistente." }, { status: 403 });
      }
    } else {
      // Legacy path: first segment must be user id or this workspace id
      const first = storagePath.replace(/^\/+/, "").split("/")[0] ?? "";
      if (first !== user.id && first !== proposta.workspace_id) {
        return Response.json({ error: "Path legado não autorizado." }, { status: 403 });
      }
    }

    const url = new URL(req.url);
    const wantSigned = url.searchParams.get("signed") === "1";

    if (wantSigned) {
      const { data: signed, error: signedError } = await supabase.storage
        .from(ALVESZ_PDF_BUCKET)
        .createSignedUrl(storagePath, ALVESZ_PDF_SIGNED_URL_TTL_SECONDS);

      if (signedError || !signed?.signedUrl) {
        return Response.json({ error: "Não foi possível assinar URL do PDF." }, { status: 500 });
      }

      return Response.json({
        signedUrl: signed.signedUrl,
        expiresIn: ALVESZ_PDF_SIGNED_URL_TTL_SECONDS,
        propostaId: proposta.id,
      });
    }

    const { data: file, error: downloadError } = await supabase.storage
      .from(ALVESZ_PDF_BUCKET)
      .download(storagePath);

    if (downloadError || !file) {
      return Response.json({ error: "Arquivo PDF não encontrado." }, { status: 404 });
    }

    const buffer = await file.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="proposta-alvesz-v${meta?.version ?? 1}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[alvesz-proposta-pdf/[id]]", error);
    return Response.json({ error: "Erro ao carregar PDF." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id?.trim()) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { data: proposta, error } = await supabase
      .from("alvesz_propostas")
      .select("id, workspace_id, pdf_meta")
      .eq("id", id.trim())
      .maybeSingle();

    if (error || !proposta) {
      return Response.json({ error: "Proposta não encontrada." }, { status: 404 });
    }

    const meta = proposta.pdf_meta as AlveszPropostaPdfMeta | null;
    const storagePath = meta?.storagePath;
    if (!storagePath) {
      return Response.json({ error: "PDF não disponível." }, { status: 404 });
    }

    if (isCanonicalAlveszPdfPath(storagePath)) {
      const allowed = assertAlveszPdfPathAllowed({
        storagePath,
        workspaceId: proposta.workspace_id,
        proposalId: proposta.id,
      });
      if (!allowed.ok) {
        return Response.json({ error: "Path de PDF inconsistente." }, { status: 403 });
      }
    }

    const { error: removeError } = await supabase.storage
      .from(ALVESZ_PDF_BUCKET)
      .remove([storagePath]);

    if (removeError) {
      return Response.json({ error: "Sem permissão para excluir PDF." }, { status: 403 });
    }

    const clearedMeta: AlveszPropostaPdfMeta = {
      ready: false,
      version: meta?.version ?? 1,
      templateId: meta?.templateId,
      history: meta?.history,
      propostaId: proposta.id,
    };
    await supabase
      .from("alvesz_propostas")
      .update({ pdf_meta: clearedMeta as unknown as Json })
      .eq("id", proposta.id)
      .eq("workspace_id", proposta.workspace_id);

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[alvesz-proposta-pdf/[id] DELETE]", error);
    return Response.json({ error: "Erro ao excluir PDF." }, { status: 500 });
  }
}
