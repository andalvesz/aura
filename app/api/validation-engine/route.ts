import { validateOpportunity } from "@/lib/validation/validation-engine";
import type { OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";
import { jsonRouteError } from "@/utils/api-json-route";

function isOpportunityRecommendation(value: unknown): value is OpportunityRecommendation {
  if (!value || typeof value !== "object") return false;
  const item = value as OpportunityRecommendation;
  return (
    typeof item.title === "string" &&
    typeof item.niche === "string" &&
    typeof item.recommendedProduct === "string" &&
    typeof item.price === "number" &&
    item.opportunityScore != null &&
    typeof item.opportunityScore.total === "number"
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { opportunity?: unknown };
    const opportunity = body.opportunity;

    if (!isOpportunityRecommendation(opportunity)) {
      return Response.json(
        { error: "Informe uma OpportunityRecommendation válida (opportunity)." },
        { status: 400 }
      );
    }

    const result = validateOpportunity(opportunity);

    return Response.json({ validation: result });
  } catch (error) {
    return jsonRouteError("validation-engine", error);
  }
}
