/**
 * In-memory store for Private Beta Operations (Sprint 10.2).
 * Mirrors platform persistence mode: memory in tests.
 */

import { newId, nowIso } from "@/lib/capabilities/store";
import type {
  AnnouncementRead,
  AnnouncementRecord,
  BetaInvite,
  ErrorGroup,
  FeatureRollout,
  FeedbackComment,
  FeedbackItem,
  FirstValueEvent,
  MaintenanceRule,
  OpsNotification,
  PlatformAuditOps,
  ProductEvent,
  ReleaseRead,
  ReleaseRecord,
} from "@/lib/beta-ops/types";

export type BetaOpsState = {
  invites: BetaInvite[];
  feedback: FeedbackItem[];
  feedbackComments: FeedbackComment[];
  releases: ReleaseRecord[];
  releaseReads: ReleaseRead[];
  announcements: AnnouncementRecord[];
  announcementReads: AnnouncementRead[];
  errorGroups: ErrorGroup[];
  productEvents: ProductEvent[];
  firstValueEvents: FirstValueEvent[];
  maintenanceRules: MaintenanceRule[];
  audit: PlatformAuditOps[];
  rollouts: FeatureRollout[];
  notifications: OpsNotification[];
  userCohorts: Record<string, string>;
  signupAtByUser: Record<string, string>;
  onboardingCompletedAtByUser: Record<string, string>;
};

declare global {
  // eslint-disable-next-line no-var
  var __AURA_BETA_OPS__: BetaOpsState | undefined;
}

export function createEmptyBetaOpsState(): BetaOpsState {
  return {
    invites: [],
    feedback: [],
    feedbackComments: [],
    releases: [],
    releaseReads: [],
    announcements: [],
    announcementReads: [],
    errorGroups: [],
    productEvents: [],
    firstValueEvents: [],
    maintenanceRules: [],
    audit: [],
    rollouts: [],
    notifications: [],
    userCohorts: {},
    signupAtByUser: {},
    onboardingCompletedAtByUser: {},
  };
}

export function getBetaOpsState(): BetaOpsState {
  if (!globalThis.__AURA_BETA_OPS__) {
    globalThis.__AURA_BETA_OPS__ = createEmptyBetaOpsState();
  }
  return globalThis.__AURA_BETA_OPS__;
}

export function setBetaOpsState(next: BetaOpsState): void {
  globalThis.__AURA_BETA_OPS__ = next;
}

export function clearBetaOpsState(): void {
  globalThis.__AURA_BETA_OPS__ = createEmptyBetaOpsState();
}

export { newId, nowIso };

export function pushOpsAudit(
  state: BetaOpsState,
  entry: Omit<PlatformAuditOps, "id" | "createdAt">
): BetaOpsState {
  return {
    ...state,
    audit: [
      ...state.audit,
      {
        id: newId("opsaud"),
        createdAt: nowIso(),
        ...entry,
      },
    ],
  };
}
