/**
 * Workspace branding — Aura Brain remains primary brand; no full white-label.
 */

import { nowIso, type PlatformState } from "@/lib/capabilities/store";
import type { WorkspaceBranding } from "@/lib/capabilities/types";

export function upsertWorkspaceBrandingPure(
  state: PlatformState,
  branding: Omit<WorkspaceBranding, "updatedAt"> & { updatedAt?: string }
): PlatformState {
  const row: WorkspaceBranding = {
    workspaceId: branding.workspaceId,
    name: branding.name.slice(0, 80),
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
    description: branding.description?.slice(0, 280) ?? null,
    icon: branding.icon,
    updatedAt: branding.updatedAt ?? nowIso(),
  };
  const others = state.branding.filter((b) => b.workspaceId !== row.workspaceId);
  return { ...state, branding: [...others, row] };
}

export function getWorkspaceBranding(
  state: PlatformState,
  workspaceId: string
): WorkspaceBranding | null {
  return state.branding.find((b) => b.workspaceId === workspaceId) ?? null;
}

export function primaryBrandLabel(branding: WorkspaceBranding | null): string {
  return branding?.name ? `${branding.name} · Aura Brain` : "Aura Brain";
}
