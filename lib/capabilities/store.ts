/**
 * In-memory platform state (V1) — mirrors Learning store pattern.
 */

import type {
  CapabilityInstallation,
  EntitlementRecord,
  FeatureFlag,
  PlatformAuditEntry,
  PlatformState,
  PlatformTemplate,
  SkillInstallation,
  UsageEvent,
  WorkspaceBranding,
  ExperienceMode,
  OnboardingAnswers,
} from "@/lib/capabilities/types";

let state: PlatformState = createEmptyPlatformState();

export function createEmptyPlatformState(): PlatformState {
  return {
    installations: [],
    skillInstallations: [],
    featureFlags: [],
    templates: [],
    branding: [],
    usageEvents: [],
    entitlements: [],
    audit: [],
    onboardingByUser: {},
    navigationOrderByUser: {},
  };
}

export function getPlatformState(): PlatformState {
  return state;
}

export function setPlatformState(next: PlatformState): void {
  state = next;
}

export function clearPlatformState(): void {
  state = createEmptyPlatformState();
}

export function nowIso(now = Date.now()): string {
  return new Date(now).toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function findCapabilityInstallation(
  s: PlatformState,
  capabilityId: string,
  userId: string,
  workspaceId: string | null
): CapabilityInstallation | undefined {
  return s.installations.find(
    (i) =>
      !i.softDeleted &&
      i.capabilityId === capabilityId &&
      i.userId === userId &&
      i.workspaceId === workspaceId
  );
}

export function findSkillInstallation(
  s: PlatformState,
  skillId: string,
  userId: string,
  workspaceId: string | null
): SkillInstallation | undefined {
  return s.skillInstallations.find(
    (i) =>
      !i.softDeleted &&
      i.skillId === skillId &&
      i.userId === userId &&
      i.workspaceId === workspaceId
  );
}

export function pushAudit(
  s: PlatformState,
  entry: Omit<PlatformAuditEntry, "id" | "createdAt"> & { createdAt?: string }
): PlatformState {
  const row: PlatformAuditEntry = {
    id: newId("audit"),
    createdAt: entry.createdAt ?? nowIso(),
    event: entry.event,
    userId: entry.userId,
    workspaceId: entry.workspaceId,
    subjectType: entry.subjectType,
    subjectId: entry.subjectId,
    summary: entry.summary,
    metadata: sanitizeAuditMeta(entry.metadata),
  };
  return { ...s, audit: [...s.audit, row] };
}

const SENSITIVE_KEYS = [
  "password",
  "secret",
  "token",
  "apiKey",
  "api_key",
  "accessToken",
  "refreshToken",
  "credential",
  "memory",
  "document",
  "financial",
];

export function sanitizeAuditMeta(
  meta: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s.toLowerCase()))) {
      continue;
    }
    if (typeof v === "string" && v.length > 500) {
      out[k] = `${v.slice(0, 500)}…`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function sanitizeExportConfig(
  config: Record<string, unknown>
): Record<string, unknown> {
  return sanitizeAuditMeta(config);
}

export type {
  PlatformState,
  CapabilityInstallation,
  SkillInstallation,
  FeatureFlag,
  PlatformTemplate,
  WorkspaceBranding,
  UsageEvent,
  EntitlementRecord,
  PlatformAuditEntry,
  ExperienceMode,
  OnboardingAnswers,
};
