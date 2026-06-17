import { generateCreativePackage } from "@/lib/supabase/services/creative-director.service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { operation_id?: string; operationId?: string };
    const operationId = body.operation_id?.trim() || body.operationId?.trim();

    if (!operationId) {
      return Response.json({ error: "Informe operation_id." }, { status: 400 });
    }

    const { package: pkg, operation, assets, message, error } =
      await generateCreativePackage(operationId);

    if (error && !pkg) {
      return Response.json({ error, assets, operation }, { status: 400 });
    }

    return Response.json({ package: pkg, operation, assets, message, error });
  } catch {
    return Response.json({ error: "Erro ao gerar pacote criativo." }, { status: 500 });
  }
}
