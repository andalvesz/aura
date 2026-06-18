import { getRealCreativeAssetPreview } from "@/lib/supabase/services/creative-generated-assets.service";

type RouteContext = { params: Promise<{ assetId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    if (!assetId?.trim()) {
      return Response.json({ error: "ID inválido." }, { status: 400 });
    }

    const { asset, previewUrl, error } = await getRealCreativeAssetPreview(assetId);

    if (error || !asset) {
      const status = error === "Usuário não autenticado." ? 401 : 404;
      return Response.json({ error: error ?? "Preview indisponível." }, { status });
    }

    if (!previewUrl) {
      return Response.json({ asset, previewUrl: null, error: "Preview indisponível." }, { status: 404 });
    }

    return Response.redirect(previewUrl, 302);
  } catch {
    return Response.json({ error: "Erro ao carregar preview." }, { status: 500 });
  }
}
