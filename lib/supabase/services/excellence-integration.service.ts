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
import {
  isProductProAutoImproveInCooldown,
  isProductProLocked,
  shouldSkipEbookAutoImprovement,
} from "@/utils/product-pro-locks";

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

export type ExcellenceReviewMode = "active" | "passive";

export type ExcellenceReviewScheduleOptions = {
  mode?: ExcellenceReviewMode;
  allowAutoImprovement?: boolean;
};

function shouldTriggerAutoImprovement(
  sourceModule: string,
  allowAutoImprovement = true
): boolean {
  if (allowAutoImprovement === false) return false;
  if (shouldSkipEbookAutoImprovement(sourceModule)) return false;
  return true;
}

export { shouldTriggerAutoImprovement as shouldTriggerExcellenceAutoImprovement };

async function triggerAutoImprovement(
  assetType: ExcellenceAssetType,
  assetId: string,
  sourceModule: string,
  allowAutoImprovement = true
): Promise<void> {
  console.info("[product-pro-trace] EXCELLENCE_TRIGGER", {
    assetId,
    assetType,
    sourceModule,
    allowAutoImprovement,
    stack: new Error().stack,
  });

  if (!shouldTriggerAutoImprovement(sourceModule, allowAutoImprovement)) {
    console.info("[product-pro] skip auto-improve for manual/passive review", {
      assetId,
      assetType,
      sourceModule,
    });
    return;
  }

  if (assetType === "ebook") {
    if (isProductProLocked(assetId)) {
      console.info("[product-pro] skip excellence auto-improve due to active lock", {
        assetId,
        sourceModule,
      });
      return;
    }

    if (isProductProAutoImproveInCooldown(assetId)) {
      console.info("[product-pro] skip auto-improve due to manual improve cooldown", {
        assetId,
        sourceModule,
      });
      return;
    }

    console.info("[stack-debug] excellence triggerAutoImprovement -> runProductFactoryProAction", {
      assetType,
      asset_id: assetId,
      action: "improve",
      sourceModule,
    });
    void import("./product-factory.service")
      .then((mod) => {
        console.info("[product-pro-trace] CALLER", {
          source: "excellence-integration.service/triggerAutoImprovement",
          assetId,
          assetType,
        });
        return mod.runProductFactoryProAction(assetId, "improve", {
          source: "excellence",
          skipExcellenceTrigger: true,
        });
      })
      .catch((error) => {
        console.error("[stack-debug] excellence auto-improve failed", {
          asset_id: assetId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      });
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
  module: string,
  allowAutoImprovement = true
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
      autoImprove: shouldTriggerAutoImprovement(module, allowAutoImprovement),
    });
    if (!shouldTriggerAutoImprovement(module, allowAutoImprovement)) {
      return;
    }
    void triggerAutoImprovement(
      result.assetType,
      result.assetId,
      module,
      allowAutoImprovement
    );
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
  mode?: ExcellenceReviewMode;
  allowAutoImprovement?: boolean;
}): Promise<ExcellencePipelineResult> {
  const allowAutoImprovement = input.allowAutoImprovement ?? input.mode !== "passive";

  logExcellenceEvent("review started", {
    module: input.module,
    assetType: input.assetType,
    assetId: input.assetId,
    label: input.label ?? null,
    mode: input.mode ?? "active",
    allowAutoImprovement,
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

  logReviewOutcome(result, input.module, allowAutoImprovement);

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
  module: string,
  options?: ExcellenceReviewScheduleOptions
): void {
  const mode = options?.mode ?? "active";
  const allowAutoImprovement = options?.allowAutoImprovement ?? mode !== "passive";

  console.info("[product-pro-trace] SCHEDULE_REVIEW", {
    factoryId: assetType === "ebook" ? assetId : null,
    assetId,
    assetType,
    module,
    label,
    mode,
    allowAutoImprovement,
    stack: new Error().stack,
  });

  void runExcellencePipeline({
    assetType,
    assetId,
    label,
    module,
    forceRefresh: true,
    mode,
    allowAutoImprovement,
  }).catch(() => undefined);
}

export function schedulePassiveExcellenceReview(
  assetType: ExcellenceAssetType,
  assetId: string,
  label?: string
): void {
  scheduleExcellenceReview(assetType, assetId, label, "passive", {
    mode: "passive",
    allowAutoImprovement: false,
  });
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
