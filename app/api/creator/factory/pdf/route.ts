import {
  publishProductFactoryPdf,
  runProductFactoryCompliance,
} from "@/lib/supabase/services/product-factory.service";
import { parseRequestJson } from "@/utils/safe-json";

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      action?: "pdf" | "compliance";
      factory_id?: string;
      pdf_base64?: string;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const factoryId = body.factory_id?.trim();
    if (!factoryId) {
      return Response.json({ error: "factory_id é obrigatório." }, { status: 400 });
    }

    if (body.action === "compliance") {
      const { compliance, error } = await runProductFactoryCompliance(factoryId);
      if (error) {
        return Response.json({ error }, { status: 400 });
      }
      return Response.json({ compliance });
    }

    const pdfBase64 = body.pdf_base64?.trim();
    if (!pdfBase64) {
      return Response.json({ error: "pdf_base64 é obrigatório." }, { status: 400 });
    }

    const { file, bundle, error } = await publishProductFactoryPdf({
      factory_id: factoryId,
      pdf_base64: pdfBase64,
    });

    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    return Response.json({ file, bundle });
  } catch {
    return Response.json({ error: "Erro ao publicar PDF." }, { status: 500 });
  }
}
