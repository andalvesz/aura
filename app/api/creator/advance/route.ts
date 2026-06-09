import { advanceCreatorStage } from "@/lib/supabase/services/creator.service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { productId?: string };
    if (!body.productId) {
      return Response.json({ error: "productId é obrigatório." }, { status: 400 });
    }

    const { bundle, error } = await advanceCreatorStage(body.productId);
    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    return Response.json({ bundle });
  } catch {
    return Response.json({ error: "Erro ao avançar estágio." }, { status: 500 });
  }
}
