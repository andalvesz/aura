"use server";

import { revalidatePath } from "next/cache";
import {
  explainDecisionCard,
  generateDecisionSupport,
  getDecisionCard,
  getHomeDecisionWidget,
  listDecisionAudit,
  listDecisionCards,
  searchDecisionCards,
  submitDecisionFeedback,
} from "@/lib/supabase/services/decision-support.service";
import type {
  DecisionFeedbackKind,
  DecisionStatus,
  DecisionKind,
} from "@/lib/decision-support/types/types";

function revalidateDecisions(decisionId?: string): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/decisions");
  if (decisionId) {
    revalidatePath(`/dashboard/decisions/${decisionId}`);
  }
}

export async function generateDecisionsAction() {
  const res = await generateDecisionSupport();
  revalidateDecisions();
  return res;
}

export async function listDecisionsAction(opts?: {
  status?: DecisionStatus | DecisionStatus[];
  kind?: DecisionKind;
  limit?: number;
  ranked?: boolean;
}) {
  return listDecisionCards(opts);
}

export async function getDecisionAction(decisionId: string) {
  return getDecisionCard(decisionId);
}

export async function submitDecisionFeedbackAction(input: {
  decisionId: string;
  kind: DecisionFeedbackKind;
  note?: string | null;
}) {
  const res = await submitDecisionFeedback(input);
  revalidateDecisions(input.decisionId);
  return res;
}

export async function explainDecisionAction(decisionId: string) {
  return explainDecisionCard(decisionId);
}

export async function searchDecisionsAction(query: string, limit?: number) {
  return searchDecisionCards(query, limit);
}

export async function getHomeDecisionWidgetAction() {
  return getHomeDecisionWidget();
}

export async function listDecisionAuditAction(limit?: number) {
  return listDecisionAudit(limit);
}
