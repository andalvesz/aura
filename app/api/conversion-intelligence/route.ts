import {
  getConversionIntelligenceDashboard,
} from "@/lib/supabase/services/conversion-intelligence.service";

export async function GET() {
  const { dashboard, insights, recommendations, error } =
    await getConversionIntelligenceDashboard();

  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({ dashboard, insights, recommendations });
}

export async function POST() {
  return Response.json(
    { error: "Use POST /api/conversion-intelligence/analyze para analisar conversões." },
    { status: 405 }
  );
}
