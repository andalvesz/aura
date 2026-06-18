import { getExcellenceDashboard } from "@/lib/supabase/services/aura-excellence.service";

export async function GET() {
  const { dashboard, scores, reviews, error } = await getExcellenceDashboard();

  if (error) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 500 }
    );
  }

  return Response.json({ dashboard, scores, reviews });
}

export async function POST() {
  return Response.json(
    { error: "Use POST /api/aura-excellence/review para auditar um ativo." },
    { status: 405 }
  );
}
