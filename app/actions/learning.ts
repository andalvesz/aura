"use server";

import { revalidatePath } from "next/cache";
import * as svc from "@/lib/supabase/services/learning.service";
import type { RawLearningEvent } from "@/lib/learning";

function revalidateLearning() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/learning");
  revalidatePath("/dashboard/brain");
}

export async function runLearningCycleAction(opts?: { minSampleSize?: number }) {
  const result = await svc.runLearningCycle(opts);
  revalidateLearning();
  return result;
}

export async function ingestLearningSignalAction(
  raw: Omit<RawLearningEvent, "userId">
) {
  const result = await svc.ingestSignal(raw);
  revalidateLearning();
  return result;
}

export async function listLearningProposalsAction(opts?: {
  status?: string | string[];
  proposalType?: string;
  query?: string;
}) {
  return svc.listLearningProposals(opts);
}

export async function getLearningProposalAction(id: string) {
  return svc.getLearningProposal(id);
}

export async function confirmLearningProposalAction(id: string) {
  const result = await svc.confirmLearningProposal(id);
  revalidateLearning();
  return result;
}

export async function rejectLearningProposalAction(id: string, reason?: string) {
  const result = await svc.rejectLearningProposal(id, reason);
  revalidateLearning();
  return result;
}

export async function applyLearningProposalAction(id: string) {
  const result = await svc.applyLearningProposal(id);
  revalidateLearning();
  return result;
}

export async function completeLearningEvaluationAction(
  id: string,
  usefulAfter?: number
) {
  const result = await svc.completeLearningEvaluation(id, usefulAfter);
  revalidateLearning();
  return result;
}

export async function revertLearningProposalAction(id: string) {
  const result = await svc.revertLearningProposal(id);
  revalidateLearning();
  return result;
}

export async function archiveLearningProposalAction(id: string) {
  const result = await svc.archiveLearningProposal(id);
  revalidateLearning();
  return result;
}

export async function getHomeLearningWidgetAction() {
  return svc.getHomeLearningWidget();
}
