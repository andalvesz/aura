import { generateRealCreativeAsset } from "@/lib/supabase/services/creative-generated-assets.service";
import type { CreativeGeneratedAssetType, CreativeMediaProviderId } from "@/types/database";
import { CREATIVE_GENERATED_ASSET_TYPES } from "@/utils/creative-media-providers";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      asset_type?: CreativeGeneratedAssetType;
      creative_id?: string;
      provider?: CreativeMediaProviderId;
      prompt?: string;
      copy?: string;
      title?: string;
      operation_id?: string;
    };

    const assetType = body.asset_type;
    if (!assetType || !CREATIVE_GENERATED_ASSET_TYPES.includes(assetType)) {
      return Response.json({ error: "Informe asset_type válido." }, { status: 400 });
    }

    const { asset, message, error } = await generateRealCreativeAsset({
      asset_type: assetType,
      creative_id: body.creative_id ?? null,
      provider: body.provider,
      prompt: body.prompt,
      copy: body.copy,
      title: body.title,
      operation_id: body.operation_id ?? null,
    });

    if (error && !asset) {
      return Response.json({ error, asset }, { status: 400 });
    }

    return Response.json({ asset, message, error });
  } catch {
    return Response.json({ error: "Erro ao gerar asset real." }, { status: 500 });
  }
}
