/**
 * User health index 0–100 — rules only, never AI.
 */

import type {
  AuraIntelligenceInput,
  IntelligenceScore,
  IntelligenceScoreDimensions,
  RuleResult,
} from "@/lib/intelligence/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return clamp(values.reduce((a, b) => a + b, 0) / values.length);
}

export function computeScore(
  input: AuraIntelligenceInput,
  ruleResults: RuleResult[]
): IntelligenceScore {
  if (input.context === "workspace") {
    return computeWorkspaceScore(input, ruleResults);
  }
  return computePersonalScore(input, ruleResults);
}

function dimFromRules(
  ruleResults: RuleResult[],
  modules: string[],
  base = 85
): number {
  let score = base;
  for (const r of ruleResults) {
    if (!modules.includes(r.module)) continue;
    if (r.status === "FAIL") {
      score -= r.severity === "CRITICAL" ? 35 : r.severity === "HIGH" ? 25 : 15;
    } else if (r.status === "WARNING") {
      score -= r.severity === "HIGH" ? 15 : r.severity === "MEDIUM" ? 10 : 5;
    }
  }
  return clamp(score);
}

function computePersonalScore(
  input: AuraIntelligenceInput,
  ruleResults: RuleResult[]
): IntelligenceScore {
  const p = input.personal;
  const empty = !p;

  const financeiro = empty
    ? 50
    : (() => {
        let s = dimFromRules(ruleResults, ["financeiro"], 80);
        if (!p.finance.hasSaldo && p.finance.gastoMes === 0) s = 55;
        if (p.finance.orcamentoPct != null) {
          if (p.finance.orcamentoPct >= 100) s = Math.min(s, 25);
          else if (p.finance.orcamentoPct >= 80) s = Math.min(s, 50);
        }
        return clamp(s);
      })();

  const saude = empty
    ? 50
    : (() => {
        let s = dimFromRules(ruleResults, ["saude", "habitos"], 80);
        if (p.health.workoutToday) s += 10;
        if (p.habits.dailyProgressPct >= 80) s += 5;
        if (p.habits.streakDays >= 3) s += 5;
        return clamp(s);
      })();

  const produtividade = empty
    ? 50
    : (() => {
        let s = dimFromRules(ruleResults, ["objetivos", "calendario"], 75);
        if (p.agenda.overdue.length === 0) s += 10;
        if (p.goals.activeCount > 0) s += 5;
        return clamp(s);
      })();

  const aprendizado = empty
    ? 50
    : (() => {
        let s = dimFromRules(ruleResults, ["idiomas", "expert_brain"], 70);
        if (p.language.practicedToday) s += 15;
        if (p.language.streak >= 3) s += 5;
        if (p.expertBrain.errors === 0 && p.expertBrain.documents > 0) s += 5;
        if (!p.language.configured && p.expertBrain.documents === 0) s = 60;
        return clamp(s);
      })();

  const organizacao = empty
    ? 50
    : (() => {
        let s = dimFromRules(
          ruleResults,
          ["calendario", "viagens", "expert_brain"],
          75
        );
        if (p.agenda.overdue.length === 0) s += 10;
        if (p.travel.trip && p.travel.trip.checklistPct >= 80) s += 5;
        return clamp(s);
      })();

  const consistencia = empty
    ? 50
    : (() => {
        let s = 60;
        s += Math.min(25, p.habits.streakDays * 5);
        s += Math.min(10, p.language.streak * 2);
        if (p.habits.dailyProgressPct >= 50) s += 10;
        if (p.habits.dailyProgressPct === 100) s += 5;
        s = dimFromRules(ruleResults, ["habitos"], s);
        return clamp(s);
      })();

  const dimensions: IntelligenceScoreDimensions = {
    financeiro,
    saude,
    produtividade,
    aprendizado,
    organizacao,
    consistencia,
  };

  return {
    ...dimensions,
    overall: avg(Object.values(dimensions)),
  };
}

function computeWorkspaceScore(
  input: AuraIntelligenceInput,
  ruleResults: RuleResult[]
): IntelligenceScore {
  const w = input.workspace;
  const base = dimFromRules(ruleResults, ["workspace"], 80);
  let organizacao = base;
  let produtividade = base;
  if (w) {
    if (w.estoqueAlerts === 0) organizacao += 10;
    if (w.followUpsPending === 0) produtividade += 10;
    if (w.openPropostas > 0) produtividade += 5;
  }
  const dimensions: IntelligenceScoreDimensions = {
    financeiro: clamp(base),
    saude: 50,
    produtividade: clamp(produtividade),
    aprendizado: 50,
    organizacao: clamp(organizacao),
    consistencia: clamp(base),
  };
  return {
    ...dimensions,
    overall: avg([
      dimensions.financeiro,
      dimensions.produtividade,
      dimensions.organizacao,
      dimensions.consistencia,
    ]),
  };
}
