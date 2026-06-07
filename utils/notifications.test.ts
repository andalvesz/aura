import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildImportantNotificationsSummary,
  buildNotificationCandidates,
} from "./notifications";
import type { Notification } from "@/types/database";

describe("notifications generator", () => {
  it("creates lead follow-up at 3 days idle", () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const candidates = buildNotificationCandidates({
      leads: [
        {
          id: "lead-2",
          user_id: "u",
          nome: "Pedro",
          status: "negociacao",
          valor_potencial: 2000,
          updated_at: threeDaysAgo.toISOString(),
          created_at: threeDaysAgo.toISOString(),
          origem: "whatsapp",
          contato: null,
          vertical: "alvesz",
          observacoes: null,
          canal: "whatsapp",
          external_id: null,
        },
      ],
      eventos: [],
      missions: [],
      conteudos: [],
      workouts: [],
      orcamentos: [],
    });

    const followUp = candidates.find((c) => c.type === "lead_followup");
    assert.ok(followUp);
    assert.match(followUp!.title, /3 dias/);
  });

  it("creates event notification for tomorrow", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = tomorrow.toISOString().slice(0, 10);

    const candidates = buildNotificationCandidates({
      leads: [],
      eventos: [
        {
          id: "evt-2",
          user_id: "u",
          titulo: "Reunião amanhã",
          descricao: null,
          data_inicio: `${tomorrowIso}T10:00:00`,
          data_fim: null,
          local: null,
          tipo: "reuniao",
          growth_lead_id: null,
          google_event_id: null,
          google_sync_status: null,
          created_at: "",
          updated_at: "",
        },
      ],
      missions: [],
      conteudos: [],
      workouts: [],
      orcamentos: [],
    });

    assert.equal(candidates.some((c) => c.type === "event_tomorrow"), true);
  });

  it("creates habit pending notification", () => {
    const today = new Date().toISOString().slice(0, 10);

    const candidates = buildNotificationCandidates({
      leads: [],
      eventos: [],
      missions: [],
      conteudos: [],
      workouts: [],
      habits: [
        {
          id: "h1",
          user_id: "u",
          titulo: "Beber água",
          frequencia: "diario",
          status: "ativo",
          data: today,
          created_at: "",
          updated_at: "",
        },
      ],
      orcamentos: [],
    });

    assert.equal(candidates.some((c) => c.type === "habit_pending"), true);
  });

  it("creates budget waiting notification", () => {
    const candidates = buildNotificationCandidates({
      leads: [],
      eventos: [],
      missions: [],
      conteudos: [],
      workouts: [],
      orcamentos: [
        {
          id: "o1",
          user_id: "u",
          cliente_id: null,
          tipo_evento: "Casamento",
          convidados: 100,
          valor_total: 50000,
          lucro_estimado: 10000,
          status: "enviado",
          data_evento: null,
          local: null,
          observacoes: null,
          growth_lead_id: null,
          created_at: "",
          updated_at: "",
        },
      ],
    });

    assert.equal(candidates.some((c) => c.type === "budget_waiting"), true);
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

  it("summarizes important unread notifications for coach", () => {
    const notifications: Notification[] = [
      {
        id: "n1",
        user_id: "u",
        title: "Lead sem follow-up há 5 dias",
        message: "Maria precisa de retorno.",
        type: "lead_followup",
        status: "unread",
        related_module: "crescimento",
        related_id: "lead-1",
        scheduled_for: null,
        created_at: new Date().toISOString(),
        read_at: null,
      },
    ];

    const summary = buildImportantNotificationsSummary(notifications, "Anderson");
    assert.match(summary, /1 alerta/);
    assert.match(summary, /Lead sem follow-up/);
  });
});
