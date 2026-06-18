import { getBlackHealthDashboard } from "@/lib/black-health.service";

export async function GET() {
  const { cards, error } = await getBlackHealthDashboard();

  if (error === "Usuário não autenticado.") {
    return Response.json({ error }, { status: 401 });
  }

  if (error) {
    return Response.json({ error, cards: [] }, { status: 500 });
  }

  return Response.json({ cards });
}
