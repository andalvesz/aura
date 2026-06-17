import { generateCreativeAsset } from "@/lib/supabase/services/creative-factory.service";
import { CREATIVE_ASSET_TYPES, type CreativeFactoryIntake } from "@/utils/creative-factory";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CreativeFactoryIntake>;
    const asset_type = body.asset_type;

    if (!asset_type || !CREATIVE_ASSET_TYPES.includes(asset_type)) {
      return Response.json({ error: "asset_type inválido." }, { status: 400 });
    }

    const { asset, operation, message, error } = await generateCreativeAsset({
      asset_type,
      operation_id: body.operation_id?.trim() || null,
      product_id: body.product_id?.trim() || null,
      titulo: body.titulo?.trim(),
      promessa: body.promessa?.trim(),
      avatar: body.avatar?.trim(),
      problema: body.problema?.trim(),
      solucao: body.solucao?.trim(),
      headline: body.headline?.trim(),
      provider: body.provider,
    });

    if (error) {
      return Response.json({ error, asset, operation }, { status: 400 });
    }

    return Response.json({ asset, operation, message });
  } catch {
    return Response.json({ error: "Erro ao gerar criativo." }, { status: 500 });
  }
}
