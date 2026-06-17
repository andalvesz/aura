import { downloadProductFactoryPdf } from "@/lib/supabase/services/product-factory.service";

type RouteContext = { params: Promise<{ fileId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { fileId } = await context.params;
    if (!fileId?.trim()) {
      return Response.json({ error: "ID do arquivo inválido." }, { status: 400 });
    }

    const { buffer, fileName, error } = await downloadProductFactoryPdf(fileId);

    if (error || !buffer) {
      const status = error === "Usuário não autenticado." ? 401 : 404;
      return Response.json({ error: error ?? "PDF não disponível." }, { status });
    }

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[ebook] download route failed", error);
    return Response.json({ error: "Erro ao baixar PDF." }, { status: 500 });
  }
}
