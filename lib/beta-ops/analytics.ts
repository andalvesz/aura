/**
 * Aggregated product analytics — respects Privacy Center consent.
 * Essential security logs are never gated.
 */

import {
  getBetaOpsState,
  newId,
  nowIso,
  setBetaOpsState,
  type BetaOpsState,
} from "@/lib/beta-ops/store";
import type { AnalyticsConsent, ProductEvent, ProductEventName } from "@/lib/beta-ops/types";
import { getPrivacyPrefs } from "@/lib/capabilities/privacy";

export const DEFAULT_ANALYTICS_CONSENT: AnalyticsConsent = {
  essential: true,
  product: false,
  performance: false,
  providers: false,
};

export function getAnalyticsConsent(userId: string): AnalyticsConsent {
  const prefs = getPrivacyPrefs(userId);
  return {
    essential: true,
    product: Boolean(prefs.analyticsProduct ?? prefs.usageAnalyticsEnabled),
    performance: Boolean(prefs.analyticsPerformance ?? prefs.usageAnalyticsEnabled),
    providers: Boolean(prefs.analyticsProviders ?? prefs.externalProvidersEnabled),
  };
}

const ESSENTIAL_EVENTS = new Set<ProductEventName>([
  "invite_failed",
  "rls_denied_unexpected",
  "session_error",
]);

const PERFORMANCE_EVENTS = new Set<ProductEventName>(["page_slow", "provider_failed"]);

export function canRecordProductEvent(
  name: ProductEventName,
  consent: AnalyticsConsent
): boolean {
  if (ESSENTIAL_EVENTS.has(name)) return true;
  if (PERFORMANCE_EVENTS.has(name)) return consent.performance || consent.essential;
  return consent.product;
}

export function recordProductEventPure(
  state: BetaOpsState,
  input: {
    name: ProductEventName;
    userId?: string | null;
    workspaceId?: string | null;
    correlationId?: string | null;
    metadata?: Record<string, unknown>;
    consentOverride?: AnalyticsConsent;
  }
): { state: BetaOpsState; recorded: boolean; event: ProductEvent | null } {
  const consent =
    input.consentOverride ??
    (input.userId ? getAnalyticsConsent(input.userId) : { ...DEFAULT_ANALYTICS_CONSENT, product: true });
  if (!canRecordProductEvent(input.name, consent)) {
    return { state, recorded: false, event: null };
  }
  const event: ProductEvent = {
    id: newId("pev"),
    name: input.name,
    userId: input.userId ?? null,
    workspaceId: input.workspaceId ?? null,
    correlationId: input.correlationId ?? null,
    metadata: input.metadata ?? {},
    createdAt: nowIso(),
  };
  return {
    state: { ...state, productEvents: [...state.productEvents, event] },
    recorded: true,
    event,
  };
}

export function aggregateUsageMetrics(state = getBetaOpsState(), now = Date.now()) {
  const dayAgo = now - 24 * 60 * 60_000;
  const weekAgo = now - 7 * 24 * 60 * 60_000;
  const events = state.productEvents;
  const unique = (names: ProductEventName[], since: number) => {
    const set = new Set<string>();
    for (const e of events) {
      if (!names.includes(e.name)) continue;
      if (new Date(e.createdAt).getTime() < since) continue;
      if (e.userId) set.add(e.userId);
    }
    return set.size;
  };
  const count = (name: ProductEventName) => events.filter((e) => e.name === name).length;
  return {
    dailyActiveUsers: unique(["daily_active", "conversation_started", "memory_created"], dayAgo),
    weeklyActiveUsers: unique(
      ["daily_active", "conversation_started", "memory_created", "project_created"],
      weekAgo
    ),
    onboardingCompleted: count("onboarding_completed"),
    memoriesCreated: count("memory_created"),
    projectsCreated: count("project_created"),
    conversations: count("conversation_started"),
    skillsInstalled: count("skill_installed"),
    discoveriesReviewed: count("discovery_reviewed"),
    plansCreated: count("plan_created"),
    automationsProposed: count("automation_proposed"),
    agentsStarted: count("agent_started"),
    firstValueCount: state.firstValueEvents.length,
  };
}

export function recordProductEvent(input: Parameters<typeof recordProductEventPure>[1]) {
  const res = recordProductEventPure(getBetaOpsState(), input);
  setBetaOpsState(res.state);
  return res;
}
