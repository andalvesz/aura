import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  eventoPayloadFromSuggestion,
  formatEventoDateDisplay,
  formatEventoTimeDisplay,
  isEventoConfirmationMessage,
  isValidEventoDate,
  normalizeAgendaMessage,
  proximosEventos,
} from "./calendar";
import type { Evento } from "@/types/database";

function makeEvento(data_inicio: string): Evento {
  return {
    id: "1",
    user_id: "u1",
    titulo: "Teste",
    descricao: null,
    data_inicio,
    data_fim: null,
    local: null,
    tipo: "geral",
    growth_lead_id: null,
    google_event_id: null,
    google_sync_status: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("Aura Agenda confirmation", () => {
  it("recognizes confirmation phrases", () => {
    for (const phrase of ["confirmado", "confirmar", "sim", "ok", "salvar"]) {
      assert.equal(isEventoConfirmationMessage(phrase), true);
      assert.equal(isEventoConfirmationMessage(`  ${phrase}!  `), true);
    }
  });

  it("rejects non-confirmation messages", () => {
    assert.equal(isEventoConfirmationMessage("reunião amanhã"), false);
    assert.equal(isEventoConfirmationMessage("não"), false);
    assert.equal(isEventoConfirmationMessage(""), false);
  });

  it("builds evento payload from suggestion", () => {
    const payload = eventoPayloadFromSuggestion({
      titulo: "Reunião João",
      descricao: "Alinhar proposta",
      data: "2026-06-03",
      hora: "15:30",
      tipo: "reuniao",
    });
    assert.equal(payload.titulo, "Reunião João");
    assert.equal(payload.descricao, "Alinhar proposta");
    assert.equal(payload.tipo, "reuniao");
    assert.equal(payload.local, null);
    assert.equal(payload.growth_lead_id, null);
    assert.ok(payload.data_inicio.includes("2026-06-03"));
  });

  it("normalizes agenda messages", () => {
    assert.equal(normalizeAgendaMessage("  OK! "), "ok");
  });
});

describe("Evento date safety", () => {
  it("validates ISO datetimes from Supabase", () => {
    assert.equal(isValidEventoDate("2026-06-03T15:30:00.000Z"), true);
    assert.equal(isValidEventoDate(""), false);
    assert.equal(isValidEventoDate(null), false);
    assert.equal(isValidEventoDate("invalid"), false);
  });

  it("formats full ISO datetimes without throwing", () => {
    const iso = "2026-06-03T15:30:00.000Z";
    assert.notEqual(formatEventoDateDisplay(iso), "Data não definida");
    assert.match(formatEventoTimeDisplay(iso), /\d{2}:\d{2}/);
    assert.equal(formatEventoDateDisplay(""), "Data não definida");
    assert.equal(formatEventoTimeDisplay("bad"), "--:--");
  });

  it("ignores invalid events in proximosEventos", () => {
    const list = proximosEventos([
      makeEvento("invalid"),
      makeEvento("2099-01-01T12:00:00.000Z"),
    ]);
    assert.equal(list.length, 1);
    assert.equal(list[0]?.data_inicio, "2099-01-01T12:00:00.000Z");
  });

  it("returns empty list when eventos is null", () => {
    assert.deepEqual(proximosEventos(null), []);
  });
});
