import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Goal } from "@/types/database";
import {
  computeGoalMetrics,
  findMostDelayedGoal,
  getActiveGoals,
  isGoalBehind,
} from "./goals";

const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  .toISOString()
  .slice(0, 10);
const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  .toISOString()
  .slice(0, 10);

const sampleGoal: Goal = {
  id: "1",
  user_id: "u",
  titulo: "Treinar 20 vezes",
  tipo: "saude",
  meta: 20,
  atual: 5,
  data_inicio: monthStart,
  data_fim: monthEnd,
  status: "ativa",
  created_at: new Date().toISOString(),
};

describe("goals utils", () => {
  it("calcula progresso e previsão", () => {
    const m = computeGoalMetrics(sampleGoal);
    assert.equal(m.pct, 25);
    assert.equal(m.remaining, 15);
    assert.ok(m.forecast >= 5);
  });

  it("lista metas ativas", () => {
    const active = getActiveGoals([sampleGoal]);
    assert.equal(active.length, 1);
  });

  it("detecta meta atrasada no meio do mês com baixo progresso", () => {
    const day = today.getDate();
    if (day >= 15) {
      assert.equal(isGoalBehind(sampleGoal), true);
    }
  });

  it("encontra meta mais atrasada", () => {
    const delayed = findMostDelayedGoal([sampleGoal]);
    assert.ok(delayed);
  });
});
