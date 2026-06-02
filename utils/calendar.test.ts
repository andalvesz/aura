import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  eventoPayloadFromSuggestion,
  isEventoConfirmationMessage,
  normalizeAgendaMessage,
} from "./calendar";

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
