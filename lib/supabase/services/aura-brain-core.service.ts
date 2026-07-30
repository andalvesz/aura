/**
 * Server service — run Aura Brain with notification adapters.
 */

import { runAuraBrain, type RunAuraBrainInput } from "@/lib/aura-brain/core";
import { setAuraBrainSettings } from "@/lib/aura-brain/context";
import type { AutonomyLevel, AuraBrainRunResult } from "@/lib/aura-brain/types";
import { getDataContext } from "@/lib/supabase/services/context";
import { NotificationsRepository } from "@/lib/supabase/repositories";
import type { NotificationType } from "@/types/database";
import { presentAuraBrainActivity } from "@/lib/aura-brain/communication/presenter";
import type { AuraIntelligenceResult } from "@/lib/intelligence/types";
import { getIdentityHintsForBrain } from "@/lib/supabase/services/identity-engine.service";
import { getMemoryContextForBrain } from "@/lib/supabase/services/memory-engine.service";
import { getWorldContextForBrain } from "@/lib/supabase/services/world-model.service";
import { getCognitiveContextForBrain } from "@/lib/supabase/services/cognitive-engine.service";
import { getDiscoveryContextForBrain } from "@/lib/supabase/services/discovery-engine.service";

export async function getAuraBrainForDashboard(options?: {
  runAutomations?: boolean;
  intelligence?: AuraIntelligenceResult;
  missionActions?: import("@/lib/missions/mission-types").MissionSuggestedAction[];
  /** When false, skip identity load (tests / isolation) */
  includeIdentity?: boolean;
  /** When false, skip memory load (tests / isolation) */
  includeMemory?: boolean;
  /** When false, skip world model load */
  includeWorld?: boolean;
  /** When false, skip cognitive engine load */
  includeCognitive?: boolean;
  /** When false, skip discovery engine load */
  includeDiscovery?: boolean;
}): Promise<{
  brain: AuraBrainRunResult;
  activity: ReturnType<typeof presentAuraBrainActivity>;
}> {
  const ctx = await getDataContext();
  const mode = ctx.activeContext === "workspace" ? "workspace" : "personal";

  const repo = new NotificationsRepository(ctx.supabase, ctx.userId);

  let identity: RunAuraBrainInput["identity"] = null;
  if (options?.includeIdentity !== false) {
    try {
      const hints = await getIdentityHintsForBrain();
      identity = {
        communicationTone: hints.communicationTone,
        preferenceLabels: hints.preferenceLabels,
        confirmedKeys: hints.decisionSafeKeys,
        constraintLabels: hints.profile.summary.constraintHints,
        conflictCount: hints.profile.summary.conflictCount,
      };
    } catch {
      identity = null;
    }
  }

  let memory: RunAuraBrainInput["memory"] = null;
  if (options?.includeMemory !== false) {
    try {
      const memCtx = await getMemoryContextForBrain({ limit: 6 });
      memory = {
        titles: memCtx.memories.map((m) => m.title),
        factCount: memCtx.memories.filter((m) => m.isFact).length,
        hypothesisCount: memCtx.memories.filter((m) => m.isHypothesis).length,
      };
    } catch {
      memory = null;
    }
  }

  let world: RunAuraBrainInput["world"] = null;
  if (options?.includeWorld !== false) {
    try {
      const w = await getWorldContextForBrain({ limit: 6 });
      world = {
        entityNames: w.entities.map((e) => e.displayName),
        relationshipSummaries: w.relationships.map(
          (r) => `${r.sourceName} [${r.relationshipType}] ${r.targetName}`
        ),
        entityCount: w.meta.entityCount,
        relationshipCount: w.meta.relationshipCount,
      };
    } catch {
      world = null;
    }
  }

  let cognitive: RunAuraBrainInput["cognitive"] = null;
  if (options?.includeCognitive !== false) {
    try {
      const c = await getCognitiveContextForBrain({ limit: 6 });
      cognitive = {
        insightTitles: c.insights.map((i) => i.title),
        patternCount: c.patterns.length,
        conflictCount: c.conflicts.length,
        recommendationCount: c.recommendations.length,
      };
    } catch {
      cognitive = null;
    }
  }

  let discovery: RunAuraBrainInput["discovery"] = null;
  if (options?.includeDiscovery !== false) {
    try {
      const d = await getDiscoveryContextForBrain({ limit: 6 });
      discovery = {
        opportunityTitles: d.opportunities.map((o) => o.title),
        riskTitles: d.risks.map((r) => r.title),
        pendingCount: d.pendingConfirmation.length,
        recentCount: d.recent.length,
      };
    } catch {
      discovery = null;
    }
  }

  const brain = await runAuraBrain({
    userId: ctx.userId,
    workspaceId: ctx.activeWorkspaceId,
    mode,
    role: ctx.workspaceRole,
    runAutomations: options?.runAutomations ?? true,
    intelligenceResult: options?.intelligence,
    missionActions: options?.missionActions,
    identity,
    memory,
    world,
    cognitive,
    discovery,
    adapters: {
      createNotification: async (payload) => {
        // related_id column is uuid — only pass if valid uuid
        const related =
          payload.related_id &&
          /^[0-9a-f-]{36}$/i.test(payload.related_id)
            ? payload.related_id
            : null;
        const { data, error } = await repo.create({
          title: payload.title,
          message: payload.message,
          type: (payload.type as NotificationType) || "aura_brain_critical",
          status: "unread",
          related_module: payload.related_module ?? "aura",
          related_id: related,
          scheduled_for: null,
          read_at: null,
        });
        return { id: data?.id ?? null, error };
      },
      findUnreadNotification: async ({ type, related_id }) => {
        const { data } = await repo.findAllOrdered();
        return (data ?? []).some(
          (n) =>
            n.status === "unread" &&
            n.type === type &&
            (n.related_id === related_id ||
              n.title.includes(related_id) ||
              n.message.includes(related_id))
        );
      },
    },
  });

  return { brain, activity: presentAuraBrainActivity(brain) };
}

export async function updateAuraBrainAutonomyAction(
  level: AutonomyLevel
): Promise<{ error: string | null }> {
  try {
    const ctx = await getDataContext();
    setAuraBrainSettings(ctx.userId, {
      defaultAutonomyLevel: level,
    });
    // Best-effort persist (table may not be in generated Database types yet)
    await (ctx.supabase as unknown as {
      from: (t: string) => {
        upsert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      };
    })
      .from("aura_brain_settings")
      .upsert({
        user_id: ctx.userId,
        default_autonomy_level: level,
        updated_at: new Date().toISOString(),
      });
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao salvar" };
  }
}
