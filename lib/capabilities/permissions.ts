/**
 * Capability / skill permissions — server-side role checks.
 */

import type { ResolveContext } from "@/lib/capabilities/types";
import { roleSatisfies } from "@/lib/capabilities/dependencies";

export function canInstallCapability(ctx: ResolveContext): boolean {
  if (ctx.role === "viewer") return false;
  return roleSatisfies(ctx.role, ["member", "admin", "owner"]);
}

export function canMutateCapability(ctx: ResolveContext): boolean {
  return canInstallCapability(ctx);
}

export function canUninstallCapability(ctx: ResolveContext): boolean {
  return roleSatisfies(ctx.role, ["admin", "owner", "member"]);
}

export function canAccessAdminPlatform(params: {
  userId: string;
  allowedUserIds: string[];
}): boolean {
  /** Never trust client-sent role — only server config allowlist. */
  return params.allowedUserIds.includes(params.userId);
}

export function getAdminAllowlistFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): string[] {
  const raw = env.AURA_PLATFORM_ADMIN_USER_IDS ?? env.PLATFORM_ADMIN_USER_IDS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function assertNotCoreUninstall(core: boolean): string | null {
  if (core) return "Core capabilities cannot be uninstalled";
  return null;
}
