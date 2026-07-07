import { runOpportunityEngine } from "@/lib/opportunity/opportunity-engine";
import { jsonRouteError } from "@/utils/api-json-route";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { goal?: string };
    const goal = body.goal?.trim();

    if (!goal) {
      return Response.json({ error: "Informe um objetivo financeiro (goal)." }, { status: 400 });
    }

    const result = runOpportunityEngine(goal);

    return Response.json({
      goal: result.goal,
      intent: result.intent,
      reasoning: result.reasoning,
      opportunities: result.recommendations,
      comparison: result.comparison,
      recommendationSummary: result.recommendationSummary,
      totalCandidates: result.totalCandidates,
    });
  } catch (error) {
    return jsonRouteError("opportunity-engine", error);
  }
}
