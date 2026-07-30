/**
 * Aura Brain Core — main orchestrator.
 *
 * Dados → Intelligence (adapter) → Planner → (optional) Automations → Audit
 * Never returns only free-form text. Never calls OpenAI.
 */

import { listRecentAudits } from "@/lib/aura-brain/audit";
import { ensureBuiltinActions } from "@/lib/aura-brain/actions/registry";
import type { ActionAdapters } from "@/lib/aura-brain/actions/types";
import { runAuraBrainAutomations } from "@/lib/aura-brain/automations/engine";
import { ensureBuiltinAutomations } from "@/lib/aura-brain/automations/registry";
import {
  buildRuntimeContext,
  getAuraBrainSettings,
} from "@/lib/aura-brain/context";
import {
  loadIntelligenceViaAdapter,
  sliceIntelligenceForBrain,
} from "@/lib/aura-brain/intelligence/adapter";
import {
  registerDefaultMemoryProviders,
  storePlanHistory,
  storeUserPreferences,
} from "@/lib/aura-brain/memory/provider";
import { runAuraBrainPlanner } from "@/lib/aura-brain/planner/planner";
import type {
  AuraBrainRunResult,
  AuraBrainSettings,
  ExecutableAction,
} from "@/lib/aura-brain/types";
import type { AuraIntelligenceInput } from "@/lib/intelligence/types";
import { evaluateActionPermission } from "@/lib/aura-brain/permissions";
import { getAction } from "@/lib/aura-brain/actions/registry";

export type RunAuraBrainInput = {
  userId: string;
  workspaceId?: string | null;
  mode: "personal" | "workspace";
  role?: string | null;
  settings?: Partial<AuraBrainSettings>;
  /** Precomputed intelligence input (tests) */
  intelligenceInput?: AuraIntelligenceInput;
  /** Precomputed intelligence result — avoids double engine run */
  intelligenceResult?: import("@/lib/intelligence/types").AuraIntelligenceResult;
  /** Skip automations (analysis-only during render) */
  runAutomations?: boolean;
  adapters?: ActionAdapters;
  pendingDedupeKeys?: string[];
  /** Mission Engine safe suggestions (LOW risk only auto path) */
  missionActions?: import("@/lib/missions/mission-types").MissionSuggestedAction[];
  /**
   * Identity Engine hints (Sprint 6.2) — read-only.
   * Must not trigger Execution / AUTO_SAFE / mission creation.
   * Hypotheses must not drive important decisions.
   */
  identity?: {
    communicationTone: string | null;
    preferenceLabels: string[];
    confirmedKeys: string[];
    constraintLabels: string[];
    conflictCount: number;
  } | null;
  /**
   * Memory Engine context (Sprint 6.3) — read-only.
   * Must not promote, execute, or create missions.
   */
  memory?: {
    titles: string[];
    factCount: number;
    hypothesisCount: number;
  } | null;
  /**
   * World Model context (Sprint 6.4) — read-only.
   * Must not execute, create missions, or assume interests.
   */
  world?: {
    entityNames: string[];
    relationshipSummaries: string[];
    entityCount: number;
    relationshipCount: number;
  } | null;
  /**
   * Cognitive Engine context (Sprint 6.5) — read-only.
   * Must not execute, create missions, or mutate other engines.
   */
  cognitive?: {
    insightTitles: string[];
    patternCount: number;
    conflictCount: number;
    recommendationCount: number;
  } | null;
  /**
   * Discovery Engine context (RC2) — read-only.
   * Must not execute, create missions, or open Decision Support.
   */
  discovery?: {
    opportunityTitles: string[];
    riskTitles: string[];
    pendingCount: number;
    recentCount: number;
  } | null;
};

export async function runAuraBrain(
  input: RunAuraBrainInput
): Promise<AuraBrainRunResult> {
  const started = Date.now();
  ensureBuiltinActions();
  ensureBuiltinAutomations();
  registerDefaultMemoryProviders();

  const runtime = buildRuntimeContext({
    userId: input.userId,
    workspaceId: input.workspaceId,
    mode: input.mode,
    role: input.role,
    settings: input.settings,
  });
  storeUserPreferences(runtime.settings);

  const intelligence =
    input.intelligenceResult ??
    (await loadIntelligenceViaAdapter({
      input: input.intelligenceInput,
      skipCache: Boolean(input.intelligenceInput),
      forcePersonal: input.mode === "personal",
    }));

  const plannerStarted = Date.now();
  const planned = runAuraBrainPlanner({
    userId: input.userId,
    context: input.mode,
    intelligence,
    settings: runtime.settings,
    pendingDedupeKeys: input.pendingDedupeKeys,
    missionActions: input.missionActions,
  });
  const plannerMs = Date.now() - plannerStarted;
  storePlanHistory(input.userId, planned.plans);

  const executableActions: ExecutableAction[] = planned.proposedActions.map(
    (p) => {
      const def = getAction(p.actionId);
      if (!def) {
        return {
          ...p,
          canExecute: false,
          blockReason: "Ação não registrada",
        };
      }
      const perm = evaluateActionPermission({
        registered: true,
        actionId: def.id,
        context: input.mode,
        allowedContexts: def.allowedContexts,
        requiredRole: def.requiredRole,
        userRole: input.role ?? null,
        settings: runtime.settings,
        autonomyRequired: def.autonomySupport,
        riskLevel: def.riskLevel,
        confirmed: false,
        isFinancial: def.isFinancial,
        isExternalComm: def.isExternalComm,
        isDeletion: def.isDeletion,
        dailyCount: 0,
        dedupeHit: false,
        cooldownActive: false,
      });
      return {
        ...p,
        canExecute: perm.allowed,
        blockReason: perm.reason,
        status: perm.allowed
          ? p.status
          : def.autonomySupport === "CONFIRM"
            ? "awaiting_confirmation"
            : "proposed",
      };
    }
  );

  let automationResults: AuraBrainRunResult["automationResults"] = [];
  const autoStarted = Date.now();
  if (input.runAutomations) {
    automationResults = await runAuraBrainAutomations({
      userId: input.userId,
      workspaceId: input.workspaceId,
      context: input.mode,
      trigger: "INTELLIGENCE_GENERATED",
      settings: runtime.settings,
      proposedActions: planned.proposedActions,
      adapters: input.adapters,
      userRole: input.role,
    });
  }
  const automationMs = Date.now() - autoStarted;

  return {
    context: {
      userId: runtime.userId,
      workspaceId: runtime.workspaceId,
      mode: runtime.mode,
      autonomy: runtime.settings.defaultAutonomyLevel,
      settings: runtime.settings,
    },
    intelligence: sliceIntelligenceForBrain(intelligence),
    identity: input.identity
      ? {
          communicationTone: input.identity.communicationTone,
          preferenceLabels: input.identity.preferenceLabels,
          confirmedKeys: input.identity.confirmedKeys,
          constraintLabels: input.identity.constraintLabels,
          conflictCount: input.identity.conflictCount,
          /** Explicit: identity never executes in this sprint */
          executionInfluence: "none" as const,
        }
      : null,
    memory: input.memory
      ? {
          titles: input.memory.titles,
          factCount: input.memory.factCount,
          hypothesisCount: input.memory.hypothesisCount,
          /** Explicit: memory never executes in this sprint */
          executionInfluence: "none" as const,
        }
      : null,
    world: input.world
      ? {
          entityNames: input.world.entityNames,
          relationshipSummaries: input.world.relationshipSummaries,
          entityCount: input.world.entityCount,
          relationshipCount: input.world.relationshipCount,
          /** Explicit: world model never executes in this sprint */
          executionInfluence: "none" as const,
        }
      : null,
    cognitive: input.cognitive
      ? {
          insightTitles: input.cognitive.insightTitles,
          patternCount: input.cognitive.patternCount,
          conflictCount: input.cognitive.conflictCount,
          recommendationCount: input.cognitive.recommendationCount,
          /** Explicit: cognitive engine never executes in this sprint */
          executionInfluence: "none" as const,
        }
      : null,
    discovery: input.discovery
      ? {
          opportunityTitles: input.discovery.opportunityTitles,
          riskTitles: input.discovery.riskTitles,
          pendingCount: input.discovery.pendingCount,
          recentCount: input.discovery.recentCount,
          /** Explicit: discovery never executes in RC2 */
          executionInfluence: "none" as const,
        }
      : null,
    plans: planned.plans,
    proposedActions: planned.proposedActions,
    executableActions,
    automationResults,
    auditEntries: listRecentAudits(input.userId, 30),
    meta: {
      generatedAt: new Date().toISOString(),
      plannerMs,
      automationMs,
      totalMs: Date.now() - started,
    },
  };
}

export { getAuraBrainSettings };
