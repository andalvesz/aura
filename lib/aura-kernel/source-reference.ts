/**
 * Aura Kernel shared contracts — RC1 baseline.
 * ADR-001…008 · Aura Brain Architecture v1.0
 *
 * Engines may keep local aliases; this is the canonical shared shape.
 */

export type SourceReference = {
  entityType: string;
  entityId: string;
  extra?: Record<string, string | number | boolean | null>;
};

/** Extended reference used in cross-layer docs and future adapters. */
export type KernelSourceReference = SourceReference & {
  layer?:
    | "identity"
    | "memory"
    | "world_model"
    | "cognitive"
    | "discovery"
    | "mission"
    | "domain"
    | "planner"
    | "user_feedback"
    | "system";
  sourceType?: string;
  sourceId?: string;
  workspaceId?: string | null;
  externalReference?: string | null;
  version?: string | null;
  observedAt?: string | null;
};

/** Cognitive kernel never influences execution in Architecture v1.0 */
export const EXECUTION_INFLUENCE_NONE = "none" as const;
export type ExecutionInfluenceV1 = typeof EXECUTION_INFLUENCE_NONE;
