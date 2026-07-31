/**
 * Privacy prefs + account export / deletion request (no instant wipe).
 */

import { exportConfigurationPure } from "@/lib/capabilities/export-import";
import { newId, nowIso, pushAudit, type PlatformState } from "@/lib/capabilities/store";
import type { ResolveContext } from "@/lib/capabilities/types";

export type PrivacyPrefs = {
  learningEnabled: boolean;
  memoryPromotionEnabled: boolean;
  externalProvidersEnabled: boolean;
  usageAnalyticsEnabled: boolean;
  /** Sprint 10.2 — analytics consent layers (essentials always on for security). */
  analyticsEssential: boolean;
  analyticsProduct: boolean;
  analyticsPerformance: boolean;
  analyticsProviders: boolean;
};

export const DEFAULT_PRIVACY_PREFS: PrivacyPrefs = {
  learningEnabled: true,
  memoryPromotionEnabled: true,
  externalProvidersEnabled: true,
  usageAnalyticsEnabled: false,
  analyticsEssential: true,
  analyticsProduct: false,
  analyticsPerformance: false,
  analyticsProviders: false,
};

declare global {
  // eslint-disable-next-line no-var
  var __AURA_PRIVACY_PREFS__: Map<string, PrivacyPrefs> | undefined;
  // eslint-disable-next-line no-var
  var __AURA_DELETION_REQUESTS__: DeletionRequest[] | undefined;
}

export type DeletionRequest = {
  id: string;
  userId: string;
  workspaceId: string | null;
  status: "REQUESTED" | "REVIEW" | "SCHEDULED" | "CANCELLED" | "COMPLETED";
  reason: string;
  impactSummary: Record<string, unknown>;
  requestedAt: string;
  reviewUntil: string | null;
  completedAt: string | null;
};

function privacyMap(): Map<string, PrivacyPrefs> {
  if (!globalThis.__AURA_PRIVACY_PREFS__) {
    globalThis.__AURA_PRIVACY_PREFS__ = new Map();
  }
  return globalThis.__AURA_PRIVACY_PREFS__;
}

function deletionBuf(): DeletionRequest[] {
  if (!globalThis.__AURA_DELETION_REQUESTS__) {
    globalThis.__AURA_DELETION_REQUESTS__ = [];
  }
  return globalThis.__AURA_DELETION_REQUESTS__;
}

export function clearPrivacyStores(): void {
  globalThis.__AURA_PRIVACY_PREFS__ = new Map();
  globalThis.__AURA_DELETION_REQUESTS__ = [];
}

export function getPrivacyPrefs(userId: string): PrivacyPrefs {
  return { ...DEFAULT_PRIVACY_PREFS, ...(privacyMap().get(userId) ?? {}) };
}

export function updatePrivacyPrefs(
  userId: string,
  patch: Partial<PrivacyPrefs>
): PrivacyPrefs {
  const next = { ...getPrivacyPrefs(userId), ...patch };
  // Security / essential logs cannot be disabled
  next.analyticsEssential = true;
  if (next.analyticsProduct || next.analyticsPerformance) {
    next.usageAnalyticsEnabled = true;
  }
  if (next.analyticsProviders) {
    next.externalProvidersEnabled = true;
  }
  privacyMap().set(userId, next);
  return next;
}

export type AccountExportBundle = {
  formatVersion: "aura-account-export/v1";
  exportedAt: string;
  profile: { userId: string };
  configuration: ReturnType<typeof exportConfigurationPure>["bundle"];
  privacy: PrivacyPrefs;
  note: string;
};

export function exportAccountDataPure(
  state: PlatformState,
  ctx: ResolveContext
): { state: PlatformState; bundle: AccountExportBundle } {
  const { state: s1, bundle: configuration } = exportConfigurationPure(state, ctx);
  const bundle: AccountExportBundle = {
    formatVersion: "aura-account-export/v1",
    exportedAt: nowIso(),
    profile: { userId: ctx.userId },
    configuration,
    privacy: getPrivacyPrefs(ctx.userId),
    note: "Export próprio. Dados privados de outros membros não incluídos. Documentos em formato referenciado apenas.",
  };
  const s = pushAudit(s1, {
    event: "configuration_exported",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    subjectType: "account_export",
    subjectId: ctx.userId,
    summary: "Account export",
    metadata: { format: bundle.formatVersion },
  });
  return { state: s, bundle };
}

export function requestAccountDeletionPure(
  state: PlatformState,
  ctx: ResolveContext,
  input: { reason: string; confirmPhrase: string }
): { state: PlatformState; ok: boolean; request: DeletionRequest | null; error?: string } {
  if (input.confirmPhrase !== "EXCLUIR MINHA CONTA") {
    return { state, ok: false, request: null, error: "confirmation_required" };
  }
  const reviewUntil = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
  const request: DeletionRequest = {
    id: newId("del"),
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    status: "REVIEW",
    reason: input.reason.slice(0, 500),
    impactSummary: {
      workspaces: "Owner deve transferir ownership antes da exclusão final",
      storage: "Objetos revisados manualmente — sem wipe automático",
      retention: "Período de recuperação de 7 dias (REVIEW)",
    },
    requestedAt: nowIso(),
    reviewUntil,
    completedAt: null,
  };
  deletionBuf().push(request);
  const s = pushAudit(state, {
    event: "admin_action",
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    subjectType: "deletion_request",
    subjectId: request.id,
    summary: "Deletion requested — pending review",
    metadata: { status: request.status },
  });
  return { state: s, ok: true, request };
}

export function listDeletionRequests(userId: string): DeletionRequest[] {
  return deletionBuf().filter((r) => r.userId === userId);
}

export function cancelDeletionRequest(
  userId: string,
  requestId: string
): DeletionRequest | null {
  const list = deletionBuf();
  const idx = list.findIndex((r) => r.id === requestId && r.userId === userId);
  if (idx < 0) return null;
  const next = { ...list[idx]!, status: "CANCELLED" as const };
  list[idx] = next;
  return next;
}
