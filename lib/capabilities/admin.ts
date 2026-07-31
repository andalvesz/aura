/**
 * Admin platform foundation — server-side allowlist only.
 */

import {
  canAccessAdminPlatform,
  getAdminAllowlistFromEnv,
} from "@/lib/capabilities/permissions";
import { listCapabilities, listSkills } from "@/lib/capabilities/registry";
import { aggregateUsage } from "@/lib/capabilities/metering";
import type { PlatformState } from "@/lib/capabilities/types";
import { pushAudit } from "@/lib/capabilities/store";

export type AdminPlatformSnapshot = {
  capabilities: Array<{ id: string; version: string; status: string; core: boolean }>;
  skills: Array<{ id: string; version: string; visibility: string; status: string }>;
  featureFlags: PlatformState["featureFlags"];
  installationErrors: Array<{ id: string; errorMessage: string | null; subject: string }>;
  pendingMigrations: string[];
  usage: Record<string, number>;
  health: { ok: boolean; registries: boolean };
  versions: { platform: string; configFormat: string };
};

export function buildAdminSnapshot(
  state: PlatformState,
  userId: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): { ok: boolean; snapshot: AdminPlatformSnapshot | null } {
  const allow = getAdminAllowlistFromEnv(env);
  if (!canAccessAdminPlatform({ userId, allowedUserIds: allow })) {
    return { ok: false, snapshot: null };
  }

  const installationErrors = [
    ...state.installations
      .filter((i) => i.status === "error" || i.errorMessage)
      .map((i) => ({
        id: i.id,
        errorMessage: i.errorMessage,
        subject: i.capabilityId,
      })),
    ...state.skillInstallations
      .filter((i) => i.status === "error" || i.errorMessage)
      .map((i) => ({
        id: i.id,
        errorMessage: i.errorMessage,
        subject: i.skillId,
      })),
  ];

  const pendingMigrations = listCapabilities()
    .filter((c) => c.requiredMigrations.length > 0)
    .flatMap((c) => c.requiredMigrations);

  return {
    ok: true,
    snapshot: {
      capabilities: listCapabilities().map((c) => ({
        id: c.id,
        version: c.version,
        status: c.status,
        core: c.core,
      })),
      skills: listSkills().map((s) => ({
        id: s.id,
        version: s.version,
        visibility: s.visibility,
        status: s.status,
      })),
      featureFlags: state.featureFlags,
      installationErrors,
      pendingMigrations,
      usage: aggregateUsage(state),
      health: { ok: true, registries: true },
      versions: { platform: "10.0.0", configFormat: "aura-platform-config/v1" },
    },
  };
}

export function recordAdminActionPure(
  state: PlatformState,
  userId: string,
  summary: string,
  metadata: Record<string, unknown> = {}
): PlatformState {
  return pushAudit(state, {
    event: "admin_action",
    userId,
    workspaceId: null,
    subjectType: "admin",
    subjectId: "platform",
    summary,
    metadata,
  });
}
