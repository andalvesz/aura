"use server";

import { revalidatePath } from "next/cache";
import {
  addPlanComment,
  approvePlan,
  archivePlan,
  assignPlanCollaborator,
  completePlan,
  completePlanStep,
  duplicatePlan,
  explainPlanItem,
  generatePlan,
  getHomePlanWidget,
  getPlanItem,
  listPlanAudit,
  listPlanComments,
  listPlanItems,
  listPlanNotifications,
  pausePlan,
  rejectPlan,
  reorderPlanSteps,
  searchPlanHits,
  searchPlanItems,
  startPlan,
  submitPlanFeedback,
  submitPlanForReview,
} from "@/lib/supabase/services/planner.service";
import type {
  PlanFeedbackKind,
  PlanRole,
  PlanSourceKind,
  PlanStatus,
} from "@/lib/planner/types/types";

function revalidatePlans(planId?: string): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/plans");
  if (planId) revalidatePath(`/dashboard/plans/${planId}`);
}

export async function generatePlanAction(input: {
  sourceKind: PlanSourceKind;
  sourceId?: string | null;
  title?: string;
  objective?: string;
}) {
  const res = await generatePlan(input);
  revalidatePlans(res.plan?.id);
  return res;
}

export async function listPlansAction(opts?: {
  status?: PlanStatus | PlanStatus[];
  projectId?: string;
  missionId?: string;
  ownerId?: string;
  limit?: number;
  offset?: number;
}) {
  return listPlanItems(opts);
}

export async function getPlanAction(planId: string) {
  return getPlanItem(planId);
}

export async function submitPlanForReviewAction(planId: string) {
  const res = await submitPlanForReview(planId);
  revalidatePlans(planId);
  return res;
}

export async function approvePlanAction(planId: string) {
  const res = await approvePlan(planId);
  revalidatePlans(planId);
  return res;
}

export async function rejectPlanAction(planId: string, note?: string) {
  const res = await rejectPlan(planId, note);
  revalidatePlans(planId);
  return res;
}

export async function startPlanAction(planId: string) {
  const res = await startPlan(planId);
  revalidatePlans(planId);
  return res;
}

export async function pausePlanAction(planId: string) {
  const res = await pausePlan(planId);
  revalidatePlans(planId);
  return res;
}

export async function completePlanStepAction(planId: string, stepId: string) {
  const res = await completePlanStep(planId, stepId);
  revalidatePlans(planId);
  return res;
}

export async function completePlanAction(planId: string, force?: boolean) {
  const res = await completePlan(planId, force);
  revalidatePlans(planId);
  return res;
}

export async function archivePlanAction(planId: string) {
  const res = await archivePlan(planId);
  revalidatePlans(planId);
  return res;
}

export async function duplicatePlanAction(planId: string) {
  const res = await duplicatePlan(planId);
  revalidatePlans(res.plan?.id);
  return res;
}

export async function reorderPlanStepsAction(
  planId: string,
  stepIdsInOrder: string[]
) {
  const res = await reorderPlanSteps(planId, stepIdsInOrder);
  revalidatePlans(planId);
  return res;
}

export async function submitPlanFeedbackAction(input: {
  planId: string;
  stepId?: string | null;
  kind: PlanFeedbackKind;
  note?: string | null;
}) {
  const res = await submitPlanFeedback(input);
  revalidatePlans(input.planId);
  return res;
}

export async function addPlanCommentAction(input: {
  planId: string;
  body: string;
  mentions?: string[];
}) {
  const res = await addPlanComment(input);
  revalidatePlans(input.planId);
  return res;
}

export async function assignPlanCollaboratorAction(input: {
  planId: string;
  targetUserId: string;
  role: PlanRole;
}) {
  const res = await assignPlanCollaborator(input);
  revalidatePlans(input.planId);
  return res;
}

export async function explainPlanAction(planId: string) {
  return explainPlanItem(planId);
}

export async function searchPlansAction(query: string, limit?: number) {
  return searchPlanItems(query, limit);
}

export async function searchPlanHitsAction(query: string, limit?: number) {
  return searchPlanHits(query, limit);
}

export async function getHomePlanWidgetAction() {
  return getHomePlanWidget();
}

export async function listPlanAuditAction(limit?: number) {
  return listPlanAudit(limit);
}

export async function listPlanCommentsAction(planId: string) {
  return listPlanComments(planId);
}

export async function listPlanNotificationsAction(limit?: number) {
  return listPlanNotifications(limit);
}
