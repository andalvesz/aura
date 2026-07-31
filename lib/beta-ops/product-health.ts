/**
 * Product health signals — distinguish expected security blocks from product errors.
 */

import { getBetaOpsState } from "@/lib/beta-ops/store";
import type { ProductEventName } from "@/lib/beta-ops/types";
import { listErrorGroups } from "@/lib/beta-ops/errors";

const PRODUCT_ERROR_EVENTS: ProductEventName[] = [
  "session_error",
  "page_slow",
  "onboarding_abandoned",
  "invite_failed",
  "upload_failed",
  "provider_failed",
  "automation_blocked",
  "agent_failed",
  "migration_missing",
];

/** Expected authz denials — NOT product errors. */
const EXPECTED_SECURITY = new Set([
  "rls_denied_expected",
  "permission_denied",
  "viewer_cannot_mutate",
  "beta_access_denied",
  "admin_denied",
]);

export function isExpectedSecurityBlock(code: string): boolean {
  return EXPECTED_SECURITY.has(code) || code.startsWith("authz_");
}

export function buildProductHealthReport(now = Date.now()) {
  const state = getBetaOpsState();
  const since = now - 24 * 60 * 60_000;
  const recent = state.productEvents.filter(
    (e) => new Date(e.createdAt).getTime() >= since
  );
  const count = (name: ProductEventName) => recent.filter((e) => e.name === name).length;
  const unexpectedRls = recent.filter(
    (e) => e.name === "rls_denied_unexpected"
  ).length;
  const errors = listErrorGroups(state).filter(
    (g) => g.status === "OPEN" || g.status === "INVESTIGATING"
  );

  return {
    errorsPerSessionSignal: count("session_error"),
    pageSlow: count("page_slow"),
    onboardingAbandoned: count("onboarding_abandoned"),
    inviteFailed: count("invite_failed"),
    uploadFailed: count("upload_failed"),
    providerFailed: count("provider_failed"),
    automationBlocked: count("automation_blocked"),
    agentFailed: count("agent_failed"),
    migrationMissing: count("migration_missing"),
    unexpectedRlsDenied: unexpectedRls,
    openErrorGroups: errors.length,
    productErrorEvents: PRODUCT_ERROR_EVENTS.map((n) => ({ name: n, count: count(n) })),
  };
}
