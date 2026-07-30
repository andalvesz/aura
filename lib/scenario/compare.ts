/**
 * Compare two or more scenarios — advantages, disadvantages, risks, opportunities, missing data.
 */

import {
  newScenarioId,
  type ScenarioCard,
  type ScenarioComparison,
  type ScenarioState,
} from "@/lib/scenario/types/types";
import { SCENARIO_TYPE_LABELS } from "@/lib/scenario/types/types";

export function compareScenariosPure(
  state: ScenarioState,
  input: {
    userId: string;
    workspaceId?: string | null;
    scenarioIds: string[];
    title?: string;
  }
): {
  state: ScenarioState;
  comparison: ScenarioComparison | null;
  error: string | null;
} {
  const ids = [...new Set(input.scenarioIds)].filter(Boolean);
  if (ids.length < 2) {
    return {
      state,
      comparison: null,
      error: "Selecione pelo menos dois cenários",
    };
  }

  const cards: ScenarioCard[] = [];
  for (const id of ids) {
    const card = state.scenarios.find((c) => c.id === id);
    if (!card || card.userId !== input.userId) {
      return { state, comparison: null, error: "Cenário inválido" };
    }
    cards.push(card);
  }

  const advantages = cards.map(
    (c) =>
      `${SCENARIO_TYPE_LABELS[c.scenarioType]}: impacto ${c.impact}, conf ${c.confidence}`
  );
  const disadvantages = cards.flatMap((c) =>
    c.limitations.slice(0, 2).map((l) => `${c.title}: ${l}`)
  );
  const risks = cards
    .filter((c) => c.scenarioType === "WORST_CASE" || c.impact === "HIGH")
    .map((c) => `Risco relativo em ${c.title}`)
    .concat(
      cards.flatMap((c) =>
        c.uncertainty.hypotheses
          .filter((h) => /risco|fricç/i.test(h))
          .map((h) => h)
      )
    );
  const opportunities = cards
    .filter((c) =>
      ["BEST_CASE", "OPTIMISTIC", "MOST_LIKELY"].includes(c.scenarioType)
    )
    .map((c) => `Oportunidade relativa: ${c.title}`);
  const missingData = [
    ...new Set(cards.flatMap((c) => c.uncertainty.missingData)),
  ];

  const ts = new Date().toISOString();
  const comparison: ScenarioComparison = {
    id: newScenarioId("scmp"),
    userId: input.userId,
    workspaceId: input.workspaceId ?? cards[0].workspaceId,
    scenarioIds: ids,
    title: input.title?.trim() || `Comparação (${ids.length} cenários)`,
    advantages,
    disadvantages,
    risks: risks.length ? risks : ["Riscos relativos implícitos nas limitações"],
    opportunities: opportunities.length
      ? opportunities
      : ["Oportunidades relativas dependem do ramo escolhido"],
    missingData,
    explanation:
      "Comparação hipotética entre ramos. Não escolhe um vencedor e não executa ações.",
    executionInfluence: "none",
    createdAt: ts,
  };

  const groupId = comparison.id;
  const nextScenarios = state.scenarios.map((c) =>
    ids.includes(c.id)
      ? {
          ...c,
          status: "COMPARED" as const,
          comparisonGroupId: groupId,
          updatedAt: ts,
          executionInfluence: "none" as const,
        }
      : c
  );

  return {
    state: {
      ...state,
      scenarios: nextScenarios,
      comparisons: [comparison, ...state.comparisons].slice(0, 100),
      audit: [
        {
          id: newScenarioId("sau"),
          userId: input.userId,
          workspaceId: comparison.workspaceId,
          scenarioId: null,
          action: "compare",
          summary: comparison.title,
          metadata: {
            scenarioIds: ids,
            executionInfluence: "none",
          },
          createdAt: ts,
        },
        ...state.audit,
      ].slice(0, 500),
    },
    comparison,
    error: null,
  };
}
