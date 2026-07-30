"use server";

import { revalidatePath } from "next/cache";
import {
  comparePriorityItems,
  explainPriorityItem,
  generatePrioritization,
  getHomePriorityWidget,
  getPriorityItem,
  listPriorityAudit,
  listPriorityItems,
  searchPriorityItems,
  submitPriorityFeedback,
} from "@/lib/supabase/services/prioritization.service";
import type {
  ImpactLevel,
  PriorityFeedbackKind,
  PriorityKind,
  PriorityStatus,
  UrgencyLevel,
} from "@/lib/prioritization/types/types";

function revalidatePriorities(priorityId?: string): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/priorities");
  if (priorityId) {
    revalidatePath(`/dashboard/priorities/${priorityId}`);
  }
}

export async function generatePrioritiesAction() {
  const res = await generatePrioritization();
  revalidatePriorities();
  return res;
}

export async function listPrioritiesAction(opts?: {
  status?: PriorityStatus | PriorityStatus[];
  kind?: PriorityKind;
  impact?: ImpactLevel;
  urgency?: UrgencyLevel;
  confidenceMin?: number;
  projectId?: string;
  businessId?: string;
  limit?: number;
  offset?: number;
  ranked?: boolean;
}) {
  return listPriorityItems(opts);
}

export async function getPriorityAction(priorityId: string) {
  return getPriorityItem(priorityId);
}

export async function submitPriorityFeedbackAction(input: {
  priorityId: string;
  kind: PriorityFeedbackKind;
  note?: string | null;
}) {
  const res = await submitPriorityFeedback(input);
  revalidatePriorities(input.priorityId);
  return res;
}

export async function explainPriorityAction(priorityId: string) {
  return explainPriorityItem(priorityId);
}

export async function searchPrioritiesAction(query: string, limit?: number) {
  return searchPriorityItems(query, limit);
}

export async function comparePrioritiesAction(input: {
  priorityIds: string[];
  title?: string;
}) {
  const res = await comparePriorityItems(input);
  revalidatePriorities();
  return res;
}

export async function getHomePriorityWidgetAction() {
  return getHomePriorityWidget();
}

export async function listPriorityAuditAction(limit?: number) {
  return listPriorityAudit(limit);
}
