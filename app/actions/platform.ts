"use server";

import { revalidatePath } from "next/cache";
import {
  disableSkillPure,
  enableSkillPure,
  installSkillPure,
  uninstallSkillPure,
} from "@/lib/capabilities/installation";
import {
  disableCapabilityPure,
  enableCapabilityPure,
} from "@/lib/capabilities/installation";
import {
  exportConfigurationPure,
  importConfigurationPure,
  previewImportPure,
} from "@/lib/capabilities/export-import";
import { setNavigationOrderPure } from "@/lib/capabilities/navigation";
import {
  advanceOnboardingStepPure,
  completeOnboardingV2Pure,
  type OnboardingV2Progress,
} from "@/lib/capabilities/onboarding-v2";
import {
  exportAccountDataPure,
  requestAccountDeletionPure,
  updatePrivacyPrefs,
  type PrivacyPrefs,
} from "@/lib/capabilities/privacy";
import { checkPlatformRateLimit } from "@/lib/capabilities/rate-limit";
import { recordPlatformEvent } from "@/lib/capabilities/observability";
import {
  loadPlatformStateForContext,
  persistPlatformState,
  resolveViewerContext,
} from "@/lib/capabilities/services/platform.service";
import { canAccessBeta, ensureBetaActive } from "@/lib/capabilities/beta-access";

export type PlatformActionResult = {
  ok: boolean;
  error?: string;
  data?: unknown;
};

async function guardedContext(): Promise<
  | { ok: true; ctx: Awaited<ReturnType<typeof resolveViewerContext>> }
  | { ok: false; error: string }
> {
  try {
    const ctx = await resolveViewerContext();
    ensureBetaActive(ctx.userId);
    if (!canAccessBeta(ctx.userId)) {
      return { ok: false, error: "beta_access_denied" };
    }
    return { ok: true, ctx };
  } catch {
    return { ok: false, error: "auth_required" };
  }
}

export async function installSkillAction(skillId: string): Promise<PlatformActionResult> {
  const gate = await guardedContext();
  if (!gate.ok) return gate;
  const rl = checkPlatformRateLimit("skill_install", gate.ctx.userId);
  if (!rl.ok) return { ok: false, error: rl.message ?? "rate_limited" };

  let state = await loadPlatformStateForContext(gate.ctx);
  const res = installSkillPure(state, skillId, gate.ctx, { activate: true });
  if (!res.ok) return { ok: false, error: res.issues.map((i) => i.message).join("; ") };
  await persistPlatformState(res.state, gate.ctx);
  recordPlatformEvent({
    event: "skill_installed",
    userId: gate.ctx.userId,
    workspaceId: gate.ctx.workspaceId,
    metadata: { skillId },
  });
  revalidatePath("/dashboard/skills");
  return { ok: true };
}

export async function enableSkillAction(skillId: string): Promise<PlatformActionResult> {
  const gate = await guardedContext();
  if (!gate.ok) return gate;
  let state = await loadPlatformStateForContext(gate.ctx);
  const res = enableSkillPure(state, skillId, gate.ctx);
  if (!res.ok) return { ok: false, error: res.issues.map((i) => i.message).join("; ") };
  await persistPlatformState(res.state, gate.ctx);
  revalidatePath("/dashboard/skills");
  return { ok: true };
}

export async function disableSkillAction(skillId: string): Promise<PlatformActionResult> {
  const gate = await guardedContext();
  if (!gate.ok) return gate;
  let state = await loadPlatformStateForContext(gate.ctx);
  const res = disableSkillPure(state, skillId, gate.ctx);
  if (!res.ok) return { ok: false, error: res.issues.map((i) => i.message).join("; ") };
  await persistPlatformState(res.state, gate.ctx);
  revalidatePath("/dashboard/skills");
  return { ok: true };
}

export async function uninstallSkillAction(skillId: string): Promise<PlatformActionResult> {
  const gate = await guardedContext();
  if (!gate.ok) return gate;
  let state = await loadPlatformStateForContext(gate.ctx);
  const res = uninstallSkillPure(state, skillId, gate.ctx);
  if (!res.ok) return { ok: false, error: res.issues.map((i) => i.message).join("; ") };
  await persistPlatformState(res.state, gate.ctx);
  revalidatePath("/dashboard/skills");
  return { ok: true };
}

export async function enableCapabilityAction(
  capabilityId: string
): Promise<PlatformActionResult> {
  const gate = await guardedContext();
  if (!gate.ok) return gate;
  let state = await loadPlatformStateForContext(gate.ctx);
  const res = enableCapabilityPure(state, capabilityId, gate.ctx);
  if (!res.ok) return { ok: false, error: res.issues.map((i) => i.message).join("; ") };
  await persistPlatformState(res.state, gate.ctx);
  recordPlatformEvent({
    event: "capability_installed",
    userId: gate.ctx.userId,
    metadata: { capabilityId, action: "enable" },
  });
  revalidatePath("/dashboard/settings/capabilities");
  return { ok: true };
}

export async function disableCapabilityAction(
  capabilityId: string
): Promise<PlatformActionResult> {
  const gate = await guardedContext();
  if (!gate.ok) return gate;
  let state = await loadPlatformStateForContext(gate.ctx);
  const res = disableCapabilityPure(state, capabilityId, gate.ctx);
  if (!res.ok) return { ok: false, error: res.issues.map((i) => i.message).join("; ") };
  await persistPlatformState(res.state, gate.ctx);
  revalidatePath("/dashboard/settings/capabilities");
  return { ok: true };
}

export async function saveNavigationOrderAction(
  order: string[]
): Promise<PlatformActionResult> {
  const gate = await guardedContext();
  if (!gate.ok) return gate;
  let state = await loadPlatformStateForContext(gate.ctx);
  state = setNavigationOrderPure(state, gate.ctx.userId, order);
  await persistPlatformState(state, gate.ctx);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function exportConfigAction(): Promise<PlatformActionResult> {
  const gate = await guardedContext();
  if (!gate.ok) return gate;
  let state = await loadPlatformStateForContext(gate.ctx);
  const { bundle, state: next } = exportConfigurationPure(state, gate.ctx);
  await persistPlatformState(next, gate.ctx);
  return { ok: true, data: bundle };
}

export async function importConfigAction(
  bundleJson: string,
  confirmed: boolean
): Promise<PlatformActionResult> {
  const gate = await guardedContext();
  if (!gate.ok) return gate;
  const rl = checkPlatformRateLimit("config_import", gate.ctx.userId);
  if (!rl.ok) return { ok: false, error: rl.message ?? "rate_limited" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(bundleJson);
  } catch {
    return { ok: false, error: "json_invalid" };
  }
  const preview = previewImportPure(parsed);
  if (!preview.ok) {
    return { ok: false, error: preview.issues.map((i) => i.message).join("; ") };
  }
  let state = await loadPlatformStateForContext(gate.ctx);
  const res = importConfigurationPure(state, gate.ctx, parsed, { confirmed });
  if (!res.ok) return { ok: false, error: res.issues.map((i) => i.message).join("; ") };
  await persistPlatformState(res.state, gate.ctx);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function advanceOnboardingAction(input: {
  progress: OnboardingV2Progress;
  nextStep: number;
  patch?: OnboardingV2Progress["answers"];
}): Promise<PlatformActionResult> {
  const gate = await guardedContext();
  if (!gate.ok) return gate;
  let state = await loadPlatformStateForContext(gate.ctx);
  const res = advanceOnboardingStepPure(
    state,
    gate.ctx,
    input.progress,
    input.nextStep,
    input.patch
  );
  if (!res.ok) return { ok: false, error: res.error };
  await persistPlatformState(res.state, gate.ctx);
  return { ok: true, data: res.progress };
}

export async function completeOnboardingAction(input: {
  progress: OnboardingV2Progress;
  installSelectedSkills?: boolean;
}): Promise<PlatformActionResult> {
  const gate = await guardedContext();
  if (!gate.ok) return gate;
  let state = await loadPlatformStateForContext(gate.ctx);
  const res = completeOnboardingV2Pure(state, gate.ctx, input.progress, {
    installSelectedSkills: input.installSelectedSkills,
  });
  await persistPlatformState(res.state, gate.ctx);
  revalidatePath("/", "layout");
  return { ok: true, data: res.progress };
}

export async function updatePrivacyAction(
  patch: Partial<PrivacyPrefs>
): Promise<PlatformActionResult> {
  const gate = await guardedContext();
  if (!gate.ok) return gate;
  const prefs = updatePrivacyPrefs(gate.ctx.userId, patch);
  revalidatePath("/dashboard/settings/privacy");
  return { ok: true, data: prefs };
}

export async function exportAccountAction(): Promise<PlatformActionResult> {
  const gate = await guardedContext();
  if (!gate.ok) return gate;
  let state = await loadPlatformStateForContext(gate.ctx);
  const { bundle, state: next } = exportAccountDataPure(state, gate.ctx);
  await persistPlatformState(next, gate.ctx);
  return { ok: true, data: bundle };
}

export async function requestDeletionAction(input: {
  reason: string;
  confirmPhrase: string;
}): Promise<PlatformActionResult> {
  const gate = await guardedContext();
  if (!gate.ok) return gate;
  let state = await loadPlatformStateForContext(gate.ctx);
  const res = requestAccountDeletionPure(state, gate.ctx, input);
  if (!res.ok) return { ok: false, error: res.error };
  await persistPlatformState(res.state, gate.ctx);
  return { ok: true, data: res.request };
}
