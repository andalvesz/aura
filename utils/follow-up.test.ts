import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GrowthLead, Orcamento } from "@/types/database";
import {
  buildDefaultFollowUpMessages,
  buildFollowUpContextFromLead,
  daysSinceContact,
  getFollowUpIdleTier,
  getTopStaleOpportunity,
  listStaleOpportunities,
} from "./follow-up";

const lead: GrowthLead = {
  id: "l1",
  user_id: "u1",
  nome: "João",
  origem: "alvesz",
  contato: "11999999999",
  status: "proposta",
  valor_potencial: 5000,
  vertical: "alvesz",
  observacoes: "Lead gerado do orçamento: Casamento",
  canal: "whatsapp",
  external_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: new Date(Date.now() - 8 * 86400000).toISOString(),
};

describe("follow-up", () => {
  it("detecta tier 7+ dias", () => {
    assert.equal(getFollowUpIdleTier(8), 7);
    assert.equal(getFollowUpIdleTier(2), null);
    assert.equal(getFollowUpIdleTier(15), 14);
  });

  it("gera mensagem whatsapp com nome do cliente", () => {
    const ctx = buildFollowUpContextFromLead(lead, null);
    const msg = buildDefaultFollowUpMessages(ctx).whatsapp;
    assert.match(msg, /João/);
    assert.match(msg, /proposta/i);
  });

  it("lista oportunidades paradas", () => {
    const items = listStaleOpportunities({ leads: [lead], orcamentos: [] });
    assert.equal(items.length, 1);
    assert.equal(items[0].context.nome, "João");
  });

  it("prioriza lead mais parado", () => {
    const top = getTopStaleOpportunity({ leads: [lead], orcamentos: [] });
    assert.equal(top?.context.nome, "João");
  });

  it("inclui orçamento sem lead vinculado", () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 86400000).toISOString();
    const orcamento: Orcamento = {
      id: "o1",
      user_id: "u1",
      cliente_id: null,
      tipo_evento: "Casamento",
      convidados: 80,
      valor_total: 5000,
      lucro_estimado: 1900,
      status: "enviado",
      data_evento: null,
      local: null,
      observacoes: null,
      growth_lead_id: null,
      created_at: fourDaysAgo,
      updated_at: fourDaysAgo,
    };
    const items = listStaleOpportunities({ leads: [], orcamentos: [orcamento] });
    assert.equal(items.length, 1);
    assert.ok(daysSinceContact(fourDaysAgo) >= 3);
  });
});
