import { createProductFromResearch } from "@/lib/supabase/services/research.service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { researchId?: string };
    if (!body.researchId) {
      return Response.json({ error: "researchId é obrigatório." }, { status: 400 });
    }

    const { bundle, error } = await createProductFromResearch(body.researchId);
    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    return Response.json({ bundle });
  } catch {
    return Response.json({ error: "Erro ao criar produto." }, { status: 500 });
  }
}
