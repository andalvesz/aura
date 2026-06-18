import {
  publishProductFactoryPdf,
} from "@/lib/supabase/services/product-factory.service";
import { parseRequestJson } from "@/utils/safe-json";

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      factory_id?: string;
      pdf_base64?: string;
      premium?: boolean;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const factoryId = body.factory_id?.trim();
    if (!factoryId) {
      return Response.json({ error: "factory_id é obrigatório." }, { status: 400 });
    }

    const pdfBase64 = body.pdf_base64?.trim();
    if (!pdfBase64) {
      return Response.json({ error: "pdf_base64 é obrigatório." }, { status: 400 });
    }

    const { file, bundle, error, qualityScore } = await publishProductFactoryPdf({
      factory_id: factoryId,
      pdf_base64: pdfBase64,
      premium: body.premium === true,
    });

    if (error) {
      return Response.json({ error, qualityScore, bundle }, { status: 400 });
    }

    return Response.json({ file, bundle, qualityScore });
  } catch {
    return Response.json({ error: "Erro ao publicar PDF." }, { status: 500 });
  }
}
