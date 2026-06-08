import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExecutiveReportData } from "@/utils/executive-reports";
import {
  AURA_COACH_ACTION_ID,
  buildCoachTodayResponse,
  detectCoachAlerts,
  detectCoachMode,
  resolveCoachResponse,
} from "./coach";

const emptyData: ExecutiveReportData = {
  clientes: [],
  orcamentos: [],
  eventos: [],
  leads: [],
  goal: null,
  missions: [],
  alveszAvailable: true,
  calendarAvailable: true,
  conteudos: [],
  gastos: [],
  healthHabits: [],
  healthWorkouts: [],
  healthMeals: [],
  healthSessions: [],
  socialAvailable: true,
  financeAvailable: true,
  healthAvailable: true,
  financialIncome: [],
  financialGoals: [],
  financialBalance: null,
  alveszEventos: [],
  weekMemories: [],
  goals: [],
  auraXp: null,
  notifications: [],
  languageProgress: null,
  languageSessions: [],
  languageLessons: [],
};

describe("Aura Coach", () => {
  it("detects coach modes from natural language", () => {
    assert.equal(detectCoachMode("O que devo fazer hoje?"), "today");
    assert.equal(detectCoachMode("O que devo fazer agora?"), "now");
    assert.equal(detectCoachMode("Como está minha semana?"), "executive-week");
    assert.equal(detectCoachMode("Como está minha rotina?"), "performance");
    assert.equal(detectCoachMode("O que devo postar hoje?"), "post-today");
    assert.equal(detectCoachMode("Como estão minhas metas?"), "goals");
    assert.equal(detectCoachMode("Qual meta está mais atrasada?"), "goals-late");
    assert.equal(detectCoachMode("Quais missões faltam?"), "xp-missions");
    assert.equal(detectCoachMode("Tenho algo importante hoje?"), "important-today");
    assert.equal(detectCoachMode("Onde devo focar?"), "opportunity");
    assert.equal(detectCoachMode("alertas"), "alerts");
    assert.equal(detectCoachMode("criar treino"), null);
  });

  it("detects aura coach action", () => {
    assert.equal(detectCoachMode("O que devo fazer hoje?", AURA_COACH_ACTION_ID), "today");
  });

  it("builds today response with five sections", () => {
    const text = buildCoachTodayResponse(emptyData, "Anderson");
    assert.match(text, /Compromissos/);
    assert.match(text, /Leads prioritários/);
    assert.match(text, /Tarefas pendentes/);
    assert.match(text, /Hábitos pendentes/);
    assert.match(text, /Conteúdos pendentes/);
  });

  it("returns intro for short aura coach message", () => {
    const { text, mode } = resolveCoachResponse("intro", emptyData, "Anderson");
    assert.equal(mode, "intro");
    assert.match(text, /Aura Coach/);
  });

  it("detects alerts without throwing on empty data", () => {
    assert.deepEqual(detectCoachAlerts(emptyData), []);
  });
});
