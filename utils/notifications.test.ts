import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildNotificationCandidates } from "./notifications";

describe("notifications generator", () => {
  it("creates lead follow-up for idle leads", () => {
    const eightDaysAgo = new Date();
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

    const candidates = buildNotificationCandidates({
      leads: [
        {
          id: "lead-1",
          user_id: "u",
          nome: "Maria",
          status: "contato",
          valor_potencial: 1000,
          updated_at: eightDaysAgo.toISOString(),
          created_at: eightDaysAgo.toISOString(),
          origem: "instagram",
          contato: null,
          vertical: null,
          observacoes: null,
          canal: "instagram",
          external_id: null,
        },
      ],
      eventos: [],
      missions: [],
      conteudos: [],
      workouts: [],
      orcamentos: [],
    });

    assert.equal(candidates.some((c) => c.type === "lead_followup"), true);
  });

  it("creates event notification for today", () => {
    const today = new Date().toISOString().slice(0, 10);

    const candidates = buildNotificationCandidates({
      leads: [],
      eventos: [
        {
          id: "evt-1",
          user_id: "u",
          titulo: "Reunião",
          descricao: null,
          data_inicio: `${today}T15:00:00`,
          data_fim: null,
          local: "Online",
          tipo: "reuniao",
          growth_lead_id: null,
          created_at: "",
          updated_at: "",
        },
      ],
      missions: [],
      conteudos: [],
      workouts: [],
      orcamentos: [],
    });

    assert.equal(candidates.some((c) => c.type === "event_upcoming"), true);
  });

  it("creates overdue content notification", () => {
    const candidates = buildNotificationCandidates({
      leads: [],
      eventos: [],
      missions: [],
      conteudos: [
        {
          id: "c1",
          user_id: "u",
          titulo: "Reel atrasado",
          status: "roteiro",
          plataforma: "instagram",
          formato: "reel",
          data_publicacao: "2020-01-01",
          objetivo: null,
          observacoes: null,
          roteiro: null,
          created_at: "",
          updated_at: "",
        },
      ],
      workouts: [],
      orcamentos: [],
    });

    assert.equal(candidates.some((c) => c.type === "content_overdue"), true);
  });
});
