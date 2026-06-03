import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { AlveszPropostaPdfMeta } from "@/utils/alvesz-proposta";
import { parseRequestJson } from "@/utils/safe-json";

function toPdfMetaJson(meta: AlveszPropostaPdfMeta): Json {
  return meta as unknown as Json;
}

const BUCKET = "alvesz-pdfs";

function decodeBase64Pdf(base64: string): Uint8Array {
  const raw = base64.includes(",") ? base64.split(",")[1]! : base64;
  const buf = Buffer.from(raw, "base64");
  return new Uint8Array(buf);
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { data: body, error: bodyError } = await parseRequestJson<{
      orcamento_id?: string;
      proposta_id?: string;
      conteudo?: string;
      melhorada_ia?: boolean;
      pdf_base64?: string;
      pdf_meta?: AlveszPropostaPdfMeta;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
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

    const pdfBytes = decodeBase64Pdf(pdfBase64);
    if (pdfBytes.length < 100) {
      return Response.json({ error: "PDF inválido." }, { status: 400 });
    }

    const pdfMeta = (body.pdf_meta ?? {}) as AlveszPropostaPdfMeta;
    const version = pdfMeta.version ?? 1;
    const propostaId = body.proposta_id?.trim();
    const storagePath = `${user.id}/${orcamentoId}/proposta-v${version}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
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

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const pdfUrl = publicData.publicUrl;

    const finalMeta: AlveszPropostaPdfMeta = {
      ...pdfMeta,
      ready: true,
      version,
      exportedAt: pdfMeta.exportedAt ?? new Date().toISOString(),
      pdfUrl,
      storagePath,
      templateId: pdfMeta.templateId ?? "alvesz-premium-v1",
    };

    let savedPropostaId = propostaId;

    if (propostaId) {
      const { error: updateError } = await supabase
        .from("alvesz_propostas")
        .update({
          conteudo,
          melhorada_ia: Boolean(body.melhorada_ia),
          pdf_meta: toPdfMetaJson(finalMeta),
        })
        .eq("id", propostaId)
        .eq("user_id", user.id);

      if (updateError) {
        return Response.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("alvesz_propostas")
        .insert({
          user_id: user.id,
          orcamento_id: orcamentoId,
          conteudo,
          melhorada_ia: Boolean(body.melhorada_ia),
          pdf_meta: toPdfMetaJson(finalMeta),
        })
        .select("id")
        .single();

      if (insertError) {
        return Response.json({ error: insertError.message }, { status: 500 });
      }
      savedPropostaId = inserted?.id ?? null;
    }

    if (savedPropostaId) {
      finalMeta.propostaId = savedPropostaId;
      finalMeta.pdfUrl = pdfUrl;
      await supabase
        .from("alvesz_propostas")
        .update({ pdf_meta: toPdfMetaJson(finalMeta) })
        .eq("id", savedPropostaId)
        .eq("user_id", user.id);
    }

    const apiPdfUrl = savedPropostaId
      ? `${origin}/api/alvesz-proposta-pdf/${savedPropostaId}`
      : null;

    return Response.json({
      propostaId: savedPropostaId,
      pdfUrl,
      publicUrl: pdfUrl,
      apiPdfUrl,
      pdf_meta: finalMeta,
    });
  } catch (error) {
    console.error("[alvesz-proposta-pdf]", error);
    return Response.json({ error: "Erro ao publicar PDF." }, { status: 500 });
  }
}
