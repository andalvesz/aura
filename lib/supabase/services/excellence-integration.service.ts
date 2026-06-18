import { recordSystemLog } from "@/lib/logs/record";
import type { ExcellenceAssetType, QualityReview, QualityScore } from "@/types/database";
import type { ExcellenceReviewStatus } from "@/utils/specialist-engine";
import {
  requireSpecialistApproval,
  reviewWithSpecialists,
  requireMultipleSpecialistApprovals,
  type SpecialistConsultResult,
  type SpecialistGateResult,
} from "./specialist-engine.service";
import type { AssetApprovalCheck } from "@/utils/specialist-engine";

export type ExcellenceLogEvent =
  | "review started"
  | "review completed"
  | "approved"
  | "regeneration requested"
  | "blocked";

export type ExcellencePipelineResult = {
  result: SpecialistConsultResult | null;
  reviews: QualityReview[];
  score: QualityScore | null;
  status: ExcellenceReviewStatus | null;
  deliverable: boolean;
  error: string | null;
};

function logExcellenceEvent(
  event: ExcellenceLogEvent,
  details: Record<string, unknown>
): void {
  console.info(`[excellence] ${event}`, details);
  const tipo =
    event === "blocked"
      ? "error"
      : event === "regeneration requested"
        ? "warning"
        : "info";

  recordSystemLog({
    tipo,
    modulo: "excellence",
    mensagem: `[excellence] ${event}`,
    detalhes: details,
  });
}

async function triggerAutoImprovement(
  assetType: ExcellenceAssetType,
  assetId: string,
  sourceModule: string
): Promise<void> {
  if (assetType === "ebook") {
    void import("./product-factory.service")
      .then((mod) => mod.runProductFactoryProAction(assetId, "improve"))
      .catch(() => undefined);
    return;
  }

  const { isAutoImproveAssetType } = await import("@/utils/excellence-auto-improve");
  if (isAutoImproveAssetType(assetType)) {
    void import("./excellence-auto-improve.service")
      .then((mod) =>
        mod.improveAsset({
          assetType,
          assetId,
          module: sourceModule,
        })
      )
      .catch(() => undefined);
    return;
  }

  void sourceModule;
}

function logReviewOutcome(
  result: SpecialistConsultResult,
  module: string
): void {
  if (result.status === "premium" || result.status === "approved") {
    logExcellenceEvent("approved", {
      module,
      assetType: result.assetType,
      assetId: result.assetId,
      label: result.label,
      finalScore: result.finalScore,
      tier: result.status,
    });
    return;
  }

  if (result.status === "regenerate") {
    logExcellenceEvent("regeneration requested", {
      module,
      assetType: result.assetType,
      assetId: result.assetId,
      label: result.label,
      finalScore: result.finalScore,
      autoImprove: true,
    });
    void triggerAutoImprovement(result.assetType, result.assetId, module);
    return;
  }

  logExcellenceEvent("blocked", {
    module,
    assetType: result.assetType,
    assetId: result.assetId,
    label: result.label,
    finalScore: result.finalScore,
  });
}

export async function runExcellencePipeline(input: {
  assetType: ExcellenceAssetType;
  assetId: string;
  label?: string;
  content?: string;
  module: string;
  forceRefresh?: boolean;
}): Promise<ExcellencePipelineResult> {
  logExcellenceEvent("review started", {
    module: input.module,
    assetType: input.assetType,
    assetId: input.assetId,
    label: input.label ?? null,
  });

  const { result, reviews, score, error } = await reviewWithSpecialists({
    asset_type: input.assetType,
    asset_id: input.assetId,
    label: input.label,
    content: input.content,
    force_refresh: input.forceRefresh ?? true,
  });

  if (error || !result) {
    return {
      result: null,
      reviews: reviews ?? [],
      score: score ?? null,
      status: null,
      deliverable: false,
      error: error ?? "Erro na auditoria de excelência.",
    };
  }

  logExcellenceEvent("review completed", {
    module: input.module,
    assetType: result.assetType,
    assetId: result.assetId,
    label: result.label,
    finalScore: result.finalScore,
    status: result.status,
    reviewCount: reviews?.length ?? 0,
  });

  logReviewOutcome(result, input.module);

  return {
    result,
    reviews: reviews ?? [],
    score: score ?? null,
    status: result.status,
    deliverable: result.approved,
    error: null,
  };
}

export function scheduleExcellenceReview(
  assetType: ExcellenceAssetType,
  assetId: string,
  label: string | undefined,
  module: string
): void {
  void runExcellencePipeline({
    assetType,
    assetId,
    label,
    module,
    forceRefresh: true,
  }).catch(() => undefined);
}

export function scheduleExcellenceReviews(
  assets: Array<{ assetType: ExcellenceAssetType; assetId: string; label?: string }>,
  module: string
): void {
  for (const asset of assets) {
    scheduleExcellenceReview(asset.assetType, asset.assetId, asset.label, module);
  }
}

export async function requireExcellenceDelivery(
  assetType: ExcellenceAssetType,
  assetId: string,
  options?: {
    forceRefresh?: boolean;
    content?: string;
    label?: string;
    module?: string;
    skipSafeMode?: boolean;
  }
): Promise<SpecialistGateResult> {
  const sourceModule = options?.module ?? "excellence";
  logExcellenceEvent("review started", {
    module: sourceModule,
    assetType,
    assetId,
    label: options?.label ?? null,
    gate: true,
  });

  const gate = await requireSpecialistApproval(assetType, assetId, options);

  if (gate.result) {
    logExcellenceEvent("review completed", {
      module: sourceModule,
      assetType,
      assetId,
      finalScore: gate.result.finalScore,
      status: gate.result.status,
      gate: true,
    });

    if (gate.allowed) {
      logExcellenceEvent("approved", {
        module: sourceModule,
        assetType,
        assetId,
        finalScore: gate.result.finalScore,
        tier: gate.result.status,
        gate: true,
      });
    } else if (gate.result.status === "regenerate") {
      logExcellenceEvent("regeneration requested", {
        module: sourceModule,
        assetType,
        assetId,
        finalScore: gate.result.finalScore,
        gate: true,
      });
      void triggerAutoImprovement(assetType, assetId, sourceModule);
    } else {
      logExcellenceEvent("blocked", {
        module: sourceModule,
        assetType,
        assetId,
        finalScore: gate.result.finalScore,
        gate: true,
      });
    }
  }

  return gate;
}

export async function requireMultipleExcellenceDeliveries(
  checks: AssetApprovalCheck[],
  options?: { module?: string; forceRefresh?: boolean }
): Promise<SpecialistGateResult> {
  const sourceModule = options?.module ?? "excellence";
  logExcellenceEvent("review started", {
    module: sourceModule,
    gate: true,
    assetCount: checks.length,
  });

  const gate = await requireMultipleSpecialistApprovals(checks, options);

  if (gate.result) {
    logExcellenceEvent("review completed", {
      module: sourceModule,
      finalScore: gate.result.finalScore,
      status: gate.result.status,
      gate: true,
      assetCount: checks.length,
    });
  }

  if (!gate.allowed) {
    logExcellenceEvent(gate.result?.status === "regenerate" ? "regeneration requested" : "blocked", {
      module: sourceModule,
      gate: true,
      assetCount: checks.length,
      error: gate.error,
    });
  } else if (gate.result) {
    logExcellenceEvent("approved", {
      module: sourceModule,
      finalScore: gate.result.finalScore,
      tier: gate.result.status,
      gate: true,
      assetCount: checks.length,
    });
  }

  return gate;
}

export type { SpecialistConsultResult, SpecialistGateResult, AssetApprovalCheck };
