import {
  analyzeKiwifyPerformance,
  autoSyncKiwifyIfDue,
  getKiwifyIntelligence,
} from "@/lib/supabase/services/kiwify-intelligence.service";

export async function GET() {
  await autoSyncKiwifyIfDue();
  const result = await getKiwifyIntelligence();
  if (result.error) {
    return Response.json({ error: result.error }, {
      status: result.error === "Usuário não autenticado." ? 401 : 500,
    });
  }
  return Response.json(result.data);
}

export async function POST() {
  const result = await analyzeKiwifyPerformance();
  if (result.error) {
    return Response.json({ error: result.error }, { status: 422 });
  }
  return Response.json({ metrics: result.metrics, insights: result.insights });
}
