import { getGrowthBrainDashboard } from "@/lib/supabase/services/growth-brain.service";

export async function GET() {
  const { dashboard, error } = await getGrowthBrainDashboard();

  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({ dashboard });
}

export async function POST() {
  return Response.json(
    { error: "Use POST /api/growth-brain/register para registrar resultados." },
    { status: 405 }
  );
}
