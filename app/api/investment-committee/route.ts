import { runInvestmentCommittee } from "@/lib/investment-committee/investment-committee";
import type { InvestmentCommitteeInput } from "@/lib/investment-committee/investment-committee-types";
import type { ProductBuildBrief } from "@/utils/product-build-brief";
import type { MasterFlowMetadata } from "@/utils/master-flow";
import type { SalesPackage } from "@/utils/sales-system";
import { jsonRouteError } from "@/utils/api-json-route";

function isSalesPackage(value: unknown): value is SalesPackage {
  if (!value || typeof value !== "object") return false;
  const pkg = value as SalesPackage;
  return (
    typeof pkg.commercialScore === "number" &&
    pkg.offer != null &&
    pkg.landing != null &&
    pkg.copy != null
  );
}

function isMasterFlowMetadata(value: unknown): value is MasterFlowMetadata {
  return value == null || (typeof value === "object" && !Array.isArray(value));
}

function isProductBuildBrief(value: unknown): value is ProductBuildBrief {
  if (!value || typeof value !== "object") return false;
  const brief = value as ProductBuildBrief;
  return typeof brief.objective === "string" && typeof brief.ticket === "number";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      salesPackage?: unknown;
      meta?: unknown;
      productBuildBrief?: unknown;
    };

    if (!isSalesPackage(body.salesPackage)) {
      return Response.json(
        { error: "Informe um SalesPackage válido (salesPackage)." },
        { status: 400 }
      );
    }

    if (!isMasterFlowMetadata(body.meta)) {
      return Response.json(
        { error: "Informe metadata de missão válida (meta)." },
        { status: 400 }
      );
    }

    if (body.productBuildBrief != null && !isProductBuildBrief(body.productBuildBrief)) {
      return Response.json(
        { error: "ProductBuildBrief inválido (productBuildBrief)." },
        { status: 400 }
      );
    }

    const input: InvestmentCommitteeInput = {
      salesPackage: body.salesPackage,
      meta: body.meta ?? {},
      productBuildBrief: body.productBuildBrief as ProductBuildBrief | null | undefined,
    };

    const report = runInvestmentCommittee(input);

    return Response.json({ report });
  } catch (error) {
    return jsonRouteError("investment-committee", error);
  }
}
