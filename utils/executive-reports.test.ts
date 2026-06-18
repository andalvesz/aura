import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExecutiveReportData } from "./executive-reports";
import {
  buildDailyExecutiveReport,
  buildWeeklyExecutiveReport,
  formatReportGreeting,
  hasWeeklyReportData,
  isExecutiveReportQuery,
  isInDateRange,
} from "./executive-reports";

const emptyData = {
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
  languageProgress: null,
  languageSessions: [],
  languageLessons: [],
  auraXp: null,
  notifications: [],
  communicationLogs: [],
} satisfies ExecutiveReportData;

describe("executive-reports", () => {
  it("formata saudação diária", () => {
    const g = formatReportGreeting("Maria");
    assert.match(g, /Maria/);
  });

  it("monta relatório diário com seções obrigatórias", () => {
    const report = buildDailyExecutiveReport(emptyData);
    assert.match(report.text, /Bom dia|Boa tarde|Boa noite/);
    assert.match(report.text, /Hoje:/);
    assert.equal(report.sections.length, 5);
    assert.equal(report.sections[0]?.label, "Leads prioritários");
    assert.equal(report.pdfMeta.ready, false);
  });

  it("monta relatório semanal com métricas", () => {
    const report = buildWeeklyExecutiveReport(emptyData);
    assert.match(report.text, /Relatório semanal/);
    assert.match(report.text, /Receitas da semana/);
    assert.match(report.text, /Despesas da semana/);
    assert.match(report.text, /Leads criados/);
    assert.match(report.text, /Memória da Aura/);
  });

  it("detecta semana sem dados", () => {
    assert.equal(hasWeeklyReportData(emptyData), false);
  });

  it("detecta pedido de relatório", () => {
    assert.equal(isExecutiveReportQuery("relatório semanal"), "weekly");
    assert.equal(isExecutiveReportQuery("relatorio mensal"), "monthly");
    assert.equal(isExecutiveReportQuery("oi"), null);
  });

  it("valida intervalo de datas", () => {
    assert.equal(isInDateRange("2026-03-05", "2026-03-01", "2026-03-10"), true);
    assert.equal(isInDateRange("2026-02-01", "2026-03-01", "2026-03-10"), false);
  });
});
