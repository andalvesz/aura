import {
  approveAsset,
  rejectAsset,
  requestRegeneration,
  reviewAsset,
} from "@/lib/supabase/services/aura-excellence.service";
import type { ExcellenceAssetType } from "@/types/database";
import { EXCELLENCE_ASSET_TYPES } from "@/utils/aura-excellence";

function isAssetType(value: unknown): value is ExcellenceAssetType {
  return typeof value === "string" && EXCELLENCE_ASSET_TYPES.includes(value as ExcellenceAssetType);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "review";
  const assetType = body.asset_type;
  const assetId = typeof body.asset_id === "string" ? body.asset_id : "";

  if (!isAssetType(assetType) || !assetId) {
    return Response.json({ error: "asset_type e asset_id são obrigatórios." }, { status: 400 });
  }

  if (action === "approve") {
    const { score, error } = await approveAsset(assetType, assetId);
    if (error) {
      return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 400 });
    }
    return Response.json({ score });
  }

  if (action === "reject") {
    const { score, error } = await rejectAsset(assetType, assetId);
    if (error) {
      return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 400 });
    }
    return Response.json({ score });
  }

  if (action === "regenerate") {
    const { score, error } = await requestRegeneration(assetType, assetId);
    if (error) {
      return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 400 });
    }
    return Response.json({ score });
  }

  const { result, reviews, score, error } = await reviewAsset({
    asset_type: assetType,
    asset_id: assetId,
    content: typeof body.content === "string" ? body.content : undefined,
    label: typeof body.label === "string" ? body.label : undefined,
    force_refresh: body.force_refresh === true,
  });

  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({ result, reviews, score });
}
