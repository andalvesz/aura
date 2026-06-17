import { downloadCreativeAsset } from "@/lib/supabase/services/creative-factory.service";

type RouteContext = { params: Promise<{ assetId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    if (!assetId?.trim()) {
      return Response.json({ error: "ID do criativo inválido." }, { status: 400 });
    }

    const { buffer, fileName, mimeType, error } = await downloadCreativeAsset(assetId);

    if (error || !buffer) {
      const status = error === "Usuário não autenticado." ? 401 : 404;
      return Response.json({ error: error ?? "Arquivo não disponível." }, { status });
    }

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[creative-factory] download route failed", error);
    return Response.json({ error: "Erro ao baixar criativo." }, { status: 500 });
  }
}
