import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Evento, Goal, GrowthLead } from "@/types/database";
import {
  buildCoachNowResponse,
  buildDailySummary,
  buildDailyTopPriorities,
} from "./daily-operations";

const today = new Date().toISOString().slice(0, 10);
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString()
  .slice(0, 10);
const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
  .toISOString()
  .slice(0, 10);

const emptyInput = {
  eventos: [],
  growthLeads: [],
  orcamentos: [],
  gastos: [],
  financialIncome: [],
  financialGoals: [],
  financialBalance: null,
  healthHabits: [],
  healthWorkouts: [],
  goals: [],
};

describe("daily-operations", () => {
  it("gera seções do resumo do dia", () => {
    const sections = buildDailySummary(emptyInput);
    assert.equal(sections.length, 6);
    assert.equal(sections[0]?.id, "compromissos");
    assert.equal(sections[1]?.id, "leads");
  });

  it("prioriza follow-up de lead parado", () => {
    const lead: GrowthLead = {
      id: "1",
      user_id: "u",
      origem: "instagram",
      nome: "Mariana",
      contato: null,
      status: "negociacao",
      valor_potencial: 8000,
      vertical: "alvesz",
      observacoes: null,
      canal: "instagram",
      external_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    };

    const evento: Evento = {
      id: "e1",
      user_id: "u",
      titulo: "Reunião",
      descricao: null,
      data_inicio: `${today}T17:30:00`,
      data_fim: `${today}T18:00:00`,
      tipo: "reuniao",
      local: null,
      google_event_id: null,
      google_sync_status: null,
      growth_lead_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const goal: Goal = {
      id: "g1",
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

    const priorities = buildDailyTopPriorities({
      ...emptyInput,
      growthLeads: [lead],
      eventos: [evento],
      goals: [goal],
    });

    assert.match(priorities[0]?.text ?? "", /Mariana/i);
    assert.equal(priorities.length, 3);

    const coach = buildCoachNowResponse(
      { ...emptyInput, growthLeads: [lead], eventos: [evento], goals: [goal] },
      "Anderson"
    );
    assert.match(coach, /Mariana/i);
    assert.match(coach, /Agora:/);
  });
});
