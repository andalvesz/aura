import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Goal, GrowthLead, Gasto } from "@/types/database";
import {
  computeBiAnalysis,
  filterBiItemsByKind,
  hasBiData,
} from "./business-intelligence";

const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  .toISOString()
  .slice(0, 10);
const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  .toISOString()
  .slice(0, 10);

const emptyInput = {
  growthLeads: [],
  consorcioLeads: [],
  eventos: [],
  alveszEventos: [],
  conteudos: [],
  gastos: [],
  financialIncome: [],
  financialGoals: [],
  financialBalance: null,
  goals: [],
  healthHabits: [],
  healthWorkouts: [],
  healthMeals: [],
  healthSessions: [],
  missions: [],
};

describe("business-intelligence", () => {
  it("detecta ausência de dados", () => {
    assert.equal(hasBiData(emptyInput), false);
  });

  it("gera análise com leads e finanças", () => {
    const lead: GrowthLead = {
      id: "1",
      user_id: "u",
      origem: "instagram",
      nome: "Cliente Teste",
      contato: null,
      status: "negociacao",
      valor_potencial: 5000,
      vertical: "alvesz",
      observacoes: null,
      canal: "instagram",
      external_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    };

    const gasto: Gasto = {
      id: "g1",
      user_id: "u",
      titulo: "Teste",
      valor: 200,
      categoria: "alimentacao",
      data: today.toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const goal: Goal = {
      id: "goal1",
      user_id: "u",
      titulo: "Treinar 20 vezes",
      tipo: "saude",
      meta: 20,
      atual: 2,
      data_inicio: monthStart,
      data_fim: monthEnd,
      status: "ativa",
      created_at: new Date().toISOString(),
    };

    const analysis = computeBiAnalysis({
      ...emptyInput,
      growthLeads: [lead],
      gastos: [gasto],
      goals: [goal],
    });

    assert.equal(hasBiData({ ...emptyInput, growthLeads: [lead] }), true);
    assert.ok(analysis.items.length > 0);
    assert.ok(analysis.questions.ondeFocar.length > 0);
    assert.ok(analysis.domainScores.length === 6);

    const oportunidades = filterBiItemsByKind(analysis.items, "oportunidade");
    assert.ok(oportunidades.length >= 1);
  });
});
