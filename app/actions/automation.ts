"use server";

import { revalidatePath } from "next/cache";
import {
  cancelAutomation,
  confirmAutomation,
  executeAutomation,
  explainAutomation,
  getAutomation,
  listAutomations,
  listAutomationAudit,
  prepareAutomation,
  processEligibleAutomations,
  proposeAutomation,
  proposeFromPlanStep,
  retryAutomation,
  revokePendingConfirmations,
  scheduleAutomation,
  searchAutomationItems,
  undoAutomation,
  updateAutomationSettings,
} from "@/lib/supabase/services/automation.service";
import type {
  AutomationListFilters,
  ProposeAutomationInput,
} from "@/lib/automation/types/types";
import type { AutonomyLevel } from "@/lib/aura-brain/types";

function revalidateAutomations(id?: string): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/automations");
  revalidatePath("/dashboard/settings/aura-brain");
  if (id) revalidatePath(`/dashboard/automations/${id}`);
}

export async function proposeAutomationAction(input: ProposeAutomationInput) {
  const res = await proposeAutomation(input);
  revalidateAutomations(res.automation?.id);
  return res;
}

export async function proposeFromPlanStepAction(input: {
  planId: string;
  planStepId: string;
  planStatus: string;
  planStepStatus: string;
  stepTitle: string;
  stepDescription?: string;
  stepType?: string;
  actionId?: string;
  projectId?: string | null;
}) {
  const res = await proposeFromPlanStep(input);
  revalidateAutomations(res.automation?.id);
  revalidatePath(`/dashboard/plans/${input.planId}`);
  return res;
}

export async function prepareAutomationAction(automationId: string) {
  const res = await prepareAutomation(automationId);
  revalidateAutomations(automationId);
  return res;
}

export async function confirmAutomationAction(
  automationId: string,
  confirmationToken: string
) {
  const res = await confirmAutomation(automationId, confirmationToken);
  revalidateAutomations(automationId);
  return res;
}

export async function executeAutomationAction(
  automationId: string,
  confirmed?: boolean
) {
  const res = await executeAutomation(automationId, { confirmed });
  revalidateAutomations(automationId);
  return res;
}

export async function scheduleAutomationAction(
  automationId: string,
  scheduledFor: string
) {
  const res = await scheduleAutomation(automationId, scheduledFor);
  revalidateAutomations(automationId);
  return res;
}

export async function cancelAutomationAction(automationId: string) {
  const res = await cancelAutomation(automationId);
  revalidateAutomations(automationId);
  return res;
}

export async function retryAutomationAction(automationId: string) {
  const res = await retryAutomation(automationId);
  revalidateAutomations(automationId);
  return res;
}

export async function undoAutomationAction(automationId: string) {
  const res = await undoAutomation(automationId);
  revalidateAutomations(automationId);
  return res;
}

export async function listAutomationsAction(filters?: AutomationListFilters) {
  return listAutomations(filters);
}

export async function getAutomationAction(id: string) {
  return getAutomation(id);
}

export async function explainAutomationAction(id: string) {
  return explainAutomation(id);
}

export async function processEligibleAutomationsAction(limit?: number) {
  const res = await processEligibleAutomations({ limit });
  revalidateAutomations();
  return res;
}

export async function searchAutomationsAction(query: string) {
  return searchAutomationItems(query);
}

export async function listAutomationAuditAction(automationId?: string) {
  return listAutomationAudit(automationId);
}

export async function updateAutomationSettingsAction(partial: {
  defaultAutonomyLevel?: AutonomyLevel;
  allowedActionTypes?: string[];
  blockedActionTypes?: string[];
  quietHours?: { startHour: number; endHour: number } | null;
  dailyExecutionLimit?: number;
  requireConfirmationForFinancialActions?: boolean;
  requireConfirmationForExternalCommunication?: boolean;
  requireConfirmationForDeletion?: boolean;
  automationsEnabled?: boolean;
  allowAutoSafe?: boolean;
  pauseAllAutomations?: boolean;
}) {
  const res = await updateAutomationSettings(partial);
  revalidatePath("/dashboard/settings/aura-brain");
  revalidatePath("/dashboard/automations");
  return res;
}

export async function revokePendingConfirmationsAction() {
  const res = await revokePendingConfirmations();
  revalidateAutomations();
  return res;
}
