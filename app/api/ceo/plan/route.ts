import { createCeoPlan } from "@/lib/supabase/services/ceo.service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { pergunta?: string };
    const pergunta = body.pergunta?.trim() ?? "";

    const { session, radar, error } = await createCeoPlan(pergunta);
    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    return Response.json({ session, radar });
  } catch {
    return Response.json({ error: "Erro ao gerar plano estratégico." }, { status: 500 });
  }
}
