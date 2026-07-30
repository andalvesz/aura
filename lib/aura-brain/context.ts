/**
 * Resolve runtime context for Aura Brain (server-side).
 */

import { mergeSettings } from "@/lib/aura-brain/autonomy";
import type {
  AuraBrainContextMode,
  AuraBrainSettings,
} from "@/lib/aura-brain/types";

export type AuraBrainRuntimeContext = {
  userId: string;
  workspaceId: string | null;
  mode: AuraBrainContextMode;
  role: string | null;
  settings: AuraBrainSettings;
};

const settingsByUser = new Map<string, AuraBrainSettings>();

export function getAuraBrainSettings(userId: string): AuraBrainSettings {
  return settingsByUser.get(userId) ?? mergeSettings(userId);
}

export function setAuraBrainSettings(
  userId: string,
  partial: Partial<AuraBrainSettings>
): AuraBrainSettings {
  const next = mergeSettings(userId, {
    ...getAuraBrainSettings(userId),
    ...partial,
    userId,
    updatedAt: new Date().toISOString(),
  });
  settingsByUser.set(userId, next);
  return next;
}

export function buildRuntimeContext(params: {
  userId: string;
  workspaceId?: string | null;
  mode: AuraBrainContextMode;
  role?: string | null;
  settings?: Partial<AuraBrainSettings>;
}): AuraBrainRuntimeContext {
  const settings = params.settings
    ? setAuraBrainSettings(params.userId, params.settings)
    : getAuraBrainSettings(params.userId);
  return {
    userId: params.userId,
    workspaceId: params.workspaceId ?? null,
    mode: params.mode,
    role: params.role ?? null,
    settings,
  };
}
