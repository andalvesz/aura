"use server";

import { revalidatePath } from "next/cache";
import {
  compareScenarioCards,
  explainScenarioCard,
  getHomeScenarioWidget,
  getScenarioCard,
  listScenarioCards,
  listScenarioComparisons,
  searchScenarioCards,
  simulateScenarios,
  submitScenarioFeedback,
} from "@/lib/supabase/services/scenario.service";
import type {
  ScenarioFeedbackKind,
  ScenarioStatus,
} from "@/lib/scenario/types/types";

function revalidateScenarios(scenarioId?: string): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/scenarios");
  if (scenarioId) revalidatePath(`/dashboard/scenarios/${scenarioId}`);
}

export async function simulateScenariosAction(input?: {
  whatIfPrompt?: string | null;
  relatedDecisionId?: string | null;
  relatedProjectId?: string | null;
  whatIfOnly?: boolean;
}) {
  const res = await simulateScenarios(input);
  revalidateScenarios();
  return res;
}

export async function listScenariosAction(opts?: {
  status?: ScenarioStatus | ScenarioStatus[];
  limit?: number;
  includeDiscarded?: boolean;
}) {
  return listScenarioCards(opts);
}

export async function getScenarioAction(scenarioId: string) {
  return getScenarioCard(scenarioId);
}

export async function submitScenarioFeedbackAction(input: {
  scenarioId: string;
  kind: ScenarioFeedbackKind;
  note?: string | null;
}) {
  const res = await submitScenarioFeedback(input);
  revalidateScenarios(input.scenarioId);
  return res;
}

export async function compareScenariosAction(input: {
  scenarioIds: string[];
  title?: string;
}) {
  const res = await compareScenarioCards(input);
  revalidateScenarios();
  return res;
}

export async function explainScenarioAction(scenarioId: string) {
  return explainScenarioCard(scenarioId);
}

export async function searchScenariosAction(query: string, limit?: number) {
  return searchScenarioCards(query, limit);
}

export async function getHomeScenarioWidgetAction() {
  return getHomeScenarioWidget();
}

export async function listScenarioComparisonsAction(limit?: number) {
  return listScenarioComparisons(limit);
}
