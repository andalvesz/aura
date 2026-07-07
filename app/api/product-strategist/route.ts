import { runProductStrategist } from "@/lib/product-strategist/product-strategist";
import type { OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";
import type { ValidationResult } from "@/lib/validation/validation-types";
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

function isValidationResult(value: unknown): value is ValidationResult {
  if (!value || typeof value !== "object") return false;
  const item = value as ValidationResult;
  return (
    typeof item.approved === "boolean" &&
    typeof item.validationScore === "number" &&
    typeof item.recommendation === "string"
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      opportunity?: unknown;
      validation?: unknown;
    };

    const { opportunity, validation } = body;

    if (!isOpportunityRecommendation(opportunity)) {
      return Response.json(
        { error: "Informe uma OpportunityRecommendation válida (opportunity)." },
        { status: 400 }
      );
    }

    if (!isValidationResult(validation)) {
      return Response.json(
        { error: "Informe um ValidationResult válido (validation)." },
        { status: 400 }
      );
    }

    if (!validation.approved) {
      return Response.json(
        { error: "A oportunidade precisa estar aprovada na validação antes da estratégia." },
        { status: 400 }
      );
    }

    const result = runProductStrategist({ opportunity, validation });

    return Response.json({ strategist: result });
  } catch (error) {
    return jsonRouteError("product-strategist", error);
  }
}
