import {
  analyzeMetaPerformance,
  autoSyncMetaIfDue,
  getMetaIntelligenceFull,
} from "@/lib/supabase/services/meta-intelligence.service";

export async function GET() {
  await autoSyncMetaIfDue();
  const result = await getMetaIntelligenceFull();
  if (result.error) {
    return Response.json({ error: result.error }, {
      status: result.error === "Usuário não autenticado." ? 401 : 500,
    });
  }
  return Response.json(result.data);
}

export async function POST() {
  const result = await analyzeMetaPerformance();
  if (result.error) {
    return Response.json({ error: result.error }, { status: 422 });
  }
  return Response.json({
    metrics: result.metrics,
    insights: result.insights,
    recommendations: result.recommendations,
    revenueCross: result.revenueCross,
  });
}
