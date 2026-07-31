/**
 * Automation service facade (Sprint 8.1).
 * All mutations resolve user/workspace on the server via getDataContext.
 */

import {
  cancelAutomationPure,
  confirmAutomationPure,
  executeAutomationPure,
  explainAutomationPure,
  getAutomationPure,
  getAutomationState,
  getHomeAutomationWidgetPure,
  listAutomationsPure,
  listAutomationAuditPure,
  prepareAutomationPure,
  processEligibleAutomationsPure,
  proposeAutomationPure,
  retryAutomationPure,
  revokePendingConfirmationsPure,
  scheduleAutomationPure,
  searchAutomationsPure,
  setAutomationState,
  undoAutomationPure,
  automationStoreKey,
  type Automation,
  type AutomationExplanation,
  type AutomationHomeWidget,
  type AutomationListFilters,
  type AutomationStatus,
  type ProposeAutomationInput,
} from "@/lib/automation";
import {
  getAuraBrainSettings,
  setAuraBrainSettings,
} from "@/lib/aura-brain/context";
import type { AuraBrainSettings } from "@/lib/aura-brain/types";
import { getDataContext } from "@/lib/supabase/services/context";

async function ctxBundle() {
  const ctx = await getDataContext();
  const ws = ctx.activeWorkspaceId ?? null;
  const key = automationStoreKey(ctx.userId, ws);
  const settings = getAuraBrainSettings(ctx.userId);
  return {
    ctx,
    ws,
    key,
    settings,
    viewer: {
      userId: ctx.userId,
      workspaceId: ws,
      role: null as string | null,
      isWorkspaceMember: Boolean(ws),
    },
  };
}

export async function proposeAutomation(
  input: ProposeAutomationInput
): Promise<{ automation: Automation | null; error: string | null }> {
  const { key, viewer, settings } = await ctxBundle();
  const state = getAutomationState(key);
  const res = proposeAutomationPure(state, viewer, input, settings);
  setAutomationState(key, res.state);
  return { automation: res.data, error: res.error };
}

export async function prepareAutomation(
  automationId: string
): Promise<{ automation: Automation | null; error: string | null }> {
  const { key, viewer, settings } = await ctxBundle();
  const res = prepareAutomationPure(
    getAutomationState(key),
    viewer,
    automationId,
    settings
  );
  setAutomationState(key, res.state);
  return { automation: res.data, error: res.error };
}

export async function confirmAutomation(
  automationId: string,
  confirmationToken: string
): Promise<{ automation: Automation | null; error: string | null }> {
  const { key, viewer, settings } = await ctxBundle();
  const res = confirmAutomationPure(
    getAutomationState(key),
    viewer,
    automationId,
    confirmationToken,
    settings
  );
  setAutomationState(key, res.state);
  return { automation: res.data, error: res.error };
}

export async function executeAutomation(
  automationId: string,
  opts?: { confirmed?: boolean }
): Promise<{ automation: Automation | null; error: string | null }> {
  const { key, viewer, settings } = await ctxBundle();
  const res = await executeAutomationPure(
    getAutomationState(key),
    viewer,
    automationId,
    settings,
    { confirmed: opts?.confirmed, forceManual: true }
  );
  setAutomationState(key, res.state);
  return { automation: res.data, error: res.error };
}

export async function scheduleAutomation(
  automationId: string,
  scheduledFor: string
): Promise<{ automation: Automation | null; error: string | null }> {
  const { key, viewer } = await ctxBundle();
  const res = scheduleAutomationPure(
    getAutomationState(key),
    viewer,
    automationId,
    scheduledFor
  );
  setAutomationState(key, res.state);
  return { automation: res.data, error: res.error };
}

export async function cancelAutomation(
  automationId: string
): Promise<{ automation: Automation | null; error: string | null }> {
  const { key, viewer } = await ctxBundle();
  const res = cancelAutomationPure(
    getAutomationState(key),
    viewer,
    automationId
  );
  setAutomationState(key, res.state);
  return { automation: res.data, error: res.error };
}

export async function retryAutomation(
  automationId: string
): Promise<{ automation: Automation | null; error: string | null }> {
  const { key, viewer, settings } = await ctxBundle();
  const res = await retryAutomationPure(
    getAutomationState(key),
    viewer,
    automationId,
    settings
  );
  setAutomationState(key, res.state);
  return { automation: res.data, error: res.error };
}

export async function undoAutomation(
  automationId: string
): Promise<{ automation: Automation | null; error: string | null }> {
  const { key, viewer } = await ctxBundle();
  const res = await undoAutomationPure(
    getAutomationState(key),
    viewer,
    automationId
  );
  setAutomationState(key, res.state);
  return { automation: res.data, error: res.error };
}

export async function listAutomations(
  filters?: AutomationListFilters
): Promise<{ items: Automation[]; error: string | null }> {
  const { key, viewer } = await ctxBundle();
  return {
    items: listAutomationsPure(getAutomationState(key), viewer, filters),
    error: null,
  };
}

export async function getAutomation(
  id: string
): Promise<{ automation: Automation | null; error: string | null }> {
  const { key, viewer } = await ctxBundle();
  const automation = getAutomationPure(getAutomationState(key), viewer, id);
  return {
    automation,
    error: automation ? null : "not_found",
  };
}

export async function explainAutomation(
  id: string
): Promise<{ explanation: AutomationExplanation | null; error: string | null }> {
  const { key, viewer } = await ctxBundle();
  const explanation = explainAutomationPure(
    getAutomationState(key),
    viewer,
    id
  );
  return {
    explanation,
    error: explanation ? null : "not_found",
  };
}

export async function processEligibleAutomations(opts?: {
  limit?: number;
}): Promise<{
  processed: number;
  results: Array<{ id: string; ok: boolean; error: string | null }>;
  error: string | null;
}> {
  const { key, viewer, settings } = await ctxBundle();
  const res = await processEligibleAutomationsPure(
    getAutomationState(key),
    viewer,
    settings,
    { limit: opts?.limit ?? 1, leaseOwner: "worker:manual" }
  );
  setAutomationState(key, res.state);
  return {
    processed: res.processed,
    results: res.results,
    error: null,
  };
}

export async function getHomeAutomationWidget(): Promise<AutomationHomeWidget> {
  const { key, viewer } = await ctxBundle();
  return getHomeAutomationWidgetPure(getAutomationState(key), viewer);
}

export async function searchAutomationItems(query: string) {
  const { key, viewer } = await ctxBundle();
  return searchAutomationsPure(getAutomationState(key), viewer, query);
}

export async function listAutomationAudit(automationId?: string) {
  const { key, viewer } = await ctxBundle();
  return listAutomationAuditPure(
    getAutomationState(key),
    viewer,
    automationId
  );
}

export async function listAutomationNotifications() {
  const { key, viewer } = await ctxBundle();
  return getAutomationState(key).notifications.filter(
    (n) => n.userId === viewer.userId
  );
}

export async function updateAutomationSettings(
  partial: Partial<
    AuraBrainSettings & {
      allowAutoSafe?: boolean;
      pauseAllAutomations?: boolean;
    }
  >
): Promise<{ settings: AuraBrainSettings; error: string | null }> {
  const { ctx } = await ctxBundle();
  const settings = setAuraBrainSettings(ctx.userId, partial);
  return { settings, error: null };
}

export async function revokePendingConfirmations(): Promise<{
  error: string | null;
}> {
  const { key, viewer } = await ctxBundle();
  const next = revokePendingConfirmationsPure(
    getAutomationState(key),
    viewer
  );
  setAutomationState(key, next);
  return { error: null };
}

export async function proposeFromPlanStep(input: {
  planId: string;
  planStepId: string;
  planStatus: string;
  planStepStatus: string;
  stepTitle: string;
  stepDescription?: string;
  stepType?: string;
  actionId?: string;
  projectId?: string | null;
}): Promise<{ automation: Automation | null; error: string | null }> {
  return proposeAutomation({
    triggerType: "PLAN_STEP",
    sourceType: "plan_step",
    sourceId: input.planStepId,
    planId: input.planId,
    planStepId: input.planStepId,
    planStatus: input.planStatus,
    planStepStatus: input.planStepStatus,
    title: `Automatizar: ${input.stepTitle}`,
    description: input.stepDescription ?? input.stepTitle,
    actionId: input.actionId,
    projectId: input.projectId,
    input: {
      title: input.stepTitle,
      message: input.stepDescription ?? `Etapa do plano ${input.planId}`,
      stepType: input.stepType,
      planId: input.planId,
      stepId: input.planStepId,
    },
  });
}

export type { Automation, AutomationStatus, AutomationHomeWidget };
