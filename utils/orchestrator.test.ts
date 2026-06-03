import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAuraCentralOpeningSummary,
  detectAuraCentralIntent,
  isAuraCentralCalendarCreateQuery,
  isAuraCentralHealthTreinoQuery,
  isAuraCentralSocialQuery,
} from "./orchestrator";
import type { AuraGlobalSummaryData } from "./mentor";

const emptyData: AuraGlobalSummaryData = {
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
};

describe("aura central orchestrator", () => {
  it("detects natural language commands", () => {
    assert.equal(detectAuraCentralIntent("O que devo fazer hoje?").module, "global");
    assert.equal(detectAuraCentralIntent("Crie meu treino de hoje").module, "saude");
    assert.equal(detectAuraCentralIntent("Crie meu treino de hoje").mode, "treino");
    assert.equal(
      detectAuraCentralIntent("Marque reunião com João amanhã").module,
      "calendario"
    );
    assert.equal(detectAuraCentralIntent("Analise minhas vendas").module, "crescimento");
    assert.equal(detectAuraCentralIntent("Crie conteúdo para Instagram").module, "social-media");
    assert.equal(detectAuraCentralIntent("Como está minha meta?").module, "crescimento");
  });

  it("detects calendar create vs read", () => {
    assert.equal(isAuraCentralCalendarCreateQuery("Marque reunião com João amanhã"), true);
    assert.equal(isAuraCentralCalendarCreateQuery("Minha agenda de hoje"), false);
  });

  it("detects health and social queries", () => {
    assert.equal(isAuraCentralHealthTreinoQuery("treino de hoje"), true);
    assert.equal(isAuraCentralSocialQuery("conteúdo para instagram"), true);
  });

  it("builds opening summary with bullets", () => {
    const summary = buildAuraCentralOpeningSummary({
      ...emptyData,
      leads: [
        {
          id: "1",
          user_id: "u",
          nome: "Lead A",
          status: "negociacao",
          valor_potencial: 5000,
          created_at: "",
          updated_at: "",
        },
        {
          id: "2",
          user_id: "u",
          nome: "Lead B",
          status: "proposta",
          valor_potencial: 3000,
          created_at: "",
          updated_at: "",
        },
      ] as AuraGlobalSummaryData["leads"],
      conteudos: [
        {
          id: "c1",
          user_id: "u",
          titulo: "Reel",
          status: "ideia",
          plataforma: "instagram",
          formato: "reel",
          created_at: "",
          updated_at: "",
        },
      ] as AuraGlobalSummaryData["conteudos"],
      eventos: [
        {
          id: "e1",
          user_id: "u",
          titulo: "Reunião",
          data_inicio: `${new Date().toISOString().slice(0, 10)}T15:00:00`,
          data_fim: `${new Date().toISOString().slice(0, 10)}T16:00:00`,
          tipo: "reuniao",
          created_at: "",
          updated_at: "",
        },
      ] as AuraGlobalSummaryData["eventos"],
    });

    assert.ok(summary.text.includes("Hoje:"));
    assert.ok(summary.bullets.some((b) => b.includes("Leads prioritários")));
    assert.ok(summary.bullets.some((b) => b.includes("Conteúdos pendentes")));
    assert.ok(summary.bullets.some((b) => b.includes("Próximos eventos")));
  });
});
