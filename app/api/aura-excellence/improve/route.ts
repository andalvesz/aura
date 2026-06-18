import { improveAsset } from "@/lib/supabase/services/excellence-auto-improve.service";
import { isAutoImproveAssetType } from "@/utils/excellence-auto-improve";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const assetType = typeof body.asset_type === "string" ? body.asset_type : "";
  const assetId = typeof body.asset_id === "string" ? body.asset_id : "";

  if (!isAutoImproveAssetType(assetType) || !assetId) {
    return Response.json(
      {
        error:
          "asset_type deve ser copy, landing, creative, offer ou funnel; asset_id é obrigatório.",
      },
      { status: 400 }
    );
  }

  const maxCycles =
    typeof body.max_cycles === "number" ? Math.min(3, Math.max(1, body.max_cycles)) : undefined;

  const { result, error } = await improveAsset({
    assetType,
    assetId,
    label: typeof body.label === "string" ? body.label : undefined,
    module: typeof body.module === "string" ? body.module : "aura-excellence",
    maxCycles,
  });

  if (error && !result) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({ result, error });
}
