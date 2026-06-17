import { downloadCreativePackage } from "@/lib/supabase/services/creative-director.service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ operationId: string }> }
) {
  try {
    const { operationId } = await context.params;
    if (!operationId?.trim()) {
      return Response.json({ error: "operationId inválido." }, { status: 400 });
    }

    const { buffer, fileName, mimeType, error } = await downloadCreativePackage(operationId);

    if (error || !buffer) {
      return Response.json({ error: error ?? "Pacote não encontrado." }, { status: 404 });
    }

    return new Response(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch {
    return Response.json({ error: "Erro ao baixar pacote criativo." }, { status: 500 });
  }
}
