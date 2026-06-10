import { runProductFactoryCompliance } from "@/lib/supabase/services/product-factory.service";
import { parseRequestJson } from "@/utils/safe-json";

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      factory_id?: string;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const factoryId = body.factory_id?.trim();
    if (!factoryId) {
      return Response.json({ error: "factory_id é obrigatório." }, { status: 400 });
    }

    const { compliance, error } = await runProductFactoryCompliance(factoryId);
    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    return Response.json({ compliance });
  } catch {
    return Response.json({ error: "Erro ao analisar compliance." }, { status: 500 });
  }
}
