import { registerRevenue } from "@/lib/supabase/services/revenue-ai.service";
import type { RevenueRegisterInput } from "@/utils/revenue-ai";

export async function POST(request: Request) {
  let body: RevenueRegisterInput;
  try {
    body = (await request.json()) as RevenueRegisterInput;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { metric, error } = await registerRevenue(body);

  if (error) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 500 }
    );
  }

  return Response.json({ metric, message: "Receita registrada no Revenue AI." });
}
