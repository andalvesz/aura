/**
 * Signal Registry — adapters declare supported events; unregistered blocked.
 */

import type {
  LearningAdapterDef,
  LearningSourceLayer,
} from "@/lib/learning/types";

const registry = new Map<LearningSourceLayer, LearningAdapterDef>();

export function clearLearningRegistry(): void {
  registry.clear();
}

export function registerLearningAdapter(def: LearningAdapterDef): void {
  registry.set(def.sourceLayer, def);
}

export function getLearningAdapter(
  layer: LearningSourceLayer
): LearningAdapterDef | null {
  return registry.get(layer) ?? null;
}

export function listLearningAdapters(): LearningAdapterDef[] {
  return [...registry.values()];
}

export function isEventRegistered(
  layer: LearningSourceLayer,
  event: string
): boolean {
  const def = registry.get(layer);
  if (!def) return false;
  return def.supportedEvents.includes(event) || def.supportedEvents.includes("*");
}

export function ensureBuiltinLearningAdapters(): void {
  if (registry.size) return;
  const defs: LearningAdapterDef[] = [
    {
      sourceLayer: "aura-brain",
      supportedEvents: ["util", "nao_util", "concluido", "ignorado", "nao_sugerir_novamente", "*"],
      normalizationSchema: "aura_brain_feedback_v1",
      defaultWeight: 1,
      sensitivity: "low",
      scope: "PERSONAL",
      dedupePolicy: "idempotency_key",
      retentionDays: 365,
    },
    {
      sourceLayer: "recommendation",
      supportedEvents: ["accept", "ignore", "archive", "request_review", "*"],
      normalizationSchema: "recommendation_feedback_v1",
      defaultWeight: 1.2,
      sensitivity: "low",
      scope: "PERSONAL",
      dedupePolicy: "idempotency_key",
      retentionDays: 365,
    },
    {
      sourceLayer: "planner",
      supportedEvents: ["accurate", "inaccurate", "useful", "not_useful", "completed", "failed", "*"],
      normalizationSchema: "plan_feedback_v1",
      defaultWeight: 1.1,
      sensitivity: "low",
      scope: "PROJECT",
      dedupePolicy: "idempotency_key",
      retentionDays: 365,
    },
    {
      sourceLayer: "automation",
      supportedEvents: ["succeeded", "failed", "cancelled", "undone", "*"],
      normalizationSchema: "automation_result_v1",
      defaultWeight: 1.3,
      sensitivity: "medium",
      scope: "AUTOMATION_ACTION",
      dedupePolicy: "idempotency_key",
      retentionDays: 180,
    },
    {
      sourceLayer: "agent-runtime",
      supportedEvents: ["completed", "partial", "blocked", "waiting_input", "*"],
      normalizationSchema: "agent_session_v1",
      defaultWeight: 1.2,
      sensitivity: "medium",
      scope: "AGENT",
      dedupePolicy: "idempotency_key",
      retentionDays: 180,
    },
    {
      sourceLayer: "conversation",
      supportedEvents: ["rated", "useful", "not_useful", "style_feedback", "*"],
      normalizationSchema: "conversation_rated_v1",
      defaultWeight: 1,
      sensitivity: "low",
      scope: "CONVERSATION_STYLE",
      dedupePolicy: "idempotency_key",
      retentionDays: 180,
    },
    {
      sourceLayer: "discovery",
      supportedEvents: ["confirmed", "rejected", "*"],
      normalizationSchema: "discovery_feedback_v1",
      defaultWeight: 1,
      sensitivity: "low",
      scope: "PERSONAL",
      dedupePolicy: "idempotency_key",
      retentionDays: 365,
    },
    {
      sourceLayer: "identity",
      supportedEvents: ["corrected", "confirmed", "*"],
      normalizationSchema: "identity_correction_v1",
      defaultWeight: 1.5,
      sensitivity: "high",
      scope: "PERSONAL",
      dedupePolicy: "idempotency_key",
      retentionDays: 730,
    },
    {
      sourceLayer: "memory",
      supportedEvents: ["corrected", "promoted", "*"],
      normalizationSchema: "memory_correction_v1",
      defaultWeight: 1.2,
      sensitivity: "medium",
      scope: "PERSONAL",
      dedupePolicy: "idempotency_key",
      retentionDays: 365,
    },
    {
      sourceLayer: "decision",
      supportedEvents: ["*", "feedback"],
      normalizationSchema: "decision_feedback_v1",
      defaultWeight: 1,
      sensitivity: "low",
      scope: "PERSONAL",
      dedupePolicy: "idempotency_key",
      retentionDays: 365,
    },
    {
      sourceLayer: "scenario",
      supportedEvents: ["*"],
      normalizationSchema: "scenario_feedback_v1",
      defaultWeight: 0.9,
      sensitivity: "low",
      scope: "PERSONAL",
      dedupePolicy: "idempotency_key",
      retentionDays: 365,
    },
    {
      sourceLayer: "prioritization",
      supportedEvents: ["*"],
      normalizationSchema: "priority_feedback_v1",
      defaultWeight: 1,
      sensitivity: "low",
      scope: "PERSONAL",
      dedupePolicy: "idempotency_key",
      retentionDays: 365,
    },
    {
      sourceLayer: "cognitive",
      supportedEvents: ["*"],
      normalizationSchema: "cognitive_feedback_v1",
      defaultWeight: 0.9,
      sensitivity: "low",
      scope: "PERSONAL",
      dedupePolicy: "idempotency_key",
      retentionDays: 365,
    },
    {
      sourceLayer: "world",
      supportedEvents: ["*"],
      normalizationSchema: "world_feedback_v1",
      defaultWeight: 0.8,
      sensitivity: "low",
      scope: "PERSONAL",
      dedupePolicy: "idempotency_key",
      retentionDays: 365,
    },
    {
      sourceLayer: "projects",
      supportedEvents: ["*"],
      normalizationSchema: "project_activity_v1",
      defaultWeight: 0.8,
      sensitivity: "low",
      scope: "PROJECT",
      dedupePolicy: "idempotency_key",
      retentionDays: 365,
    },
    {
      sourceLayer: "knowledge",
      supportedEvents: ["*"],
      normalizationSchema: "knowledge_feedback_v1",
      defaultWeight: 0.8,
      sensitivity: "low",
      scope: "PERSONAL",
      dedupePolicy: "idempotency_key",
      retentionDays: 365,
    },
    {
      sourceLayer: "daily",
      supportedEvents: ["*"],
      normalizationSchema: "daily_ops_v1",
      defaultWeight: 0.7,
      sensitivity: "low",
      scope: "PERSONAL",
      dedupePolicy: "idempotency_key",
      retentionDays: 180,
    },
    {
      sourceLayer: "business-expert",
      supportedEvents: [
        "intent:open_business",
        "intent:start_entrepreneurship",
        "intent:make_money",
        "intent:validate_idea",
        "intent:create_company",
        "intent:advise",
        "intent:plan",
        "profile_updated",
        "plan_drafted",
        "*",
      ],
      normalizationSchema: "business_expert_signal_v1",
      defaultWeight: 1,
      sensitivity: "low",
      scope: "PERSONAL",
      dedupePolicy: "idempotency_key",
      retentionDays: 365,
    },
  ];
  for (const d of defs) registerLearningAdapter(d);
}
