import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Cliente, Orcamento } from "@/types/database";
import {
  buildAlveszProposta,
  formatPropostaWhatsApp,
  suggestPacoteAlvesz,
} from "./alvesz-proposta";

const baseOrcamento: Orcamento = {
  id: "o1",
  user_id: "u1",
  cliente_id: "c1",
  tipo_evento: "Casamento Premium",
  convidados: 120,
  valor_total: 15000,
  lucro_estimado: 5700,
  status: "enviado",
  data_evento: "2026-08-15",
  local: "Fazenda Vista",
  observacoes: "Bar externo",
  growth_lead_id: null,
  created_at: "",
  updated_at: "",
};

const cliente: Cliente = {
  id: "c1",
  user_id: "u1",
  nome: "Maria Silva",
  telefone: "11999999999",
  email: null,
  instagram: null,
  tipo: "pessoa_fisica",
  observacoes: null,
  created_at: "",
  updated_at: "",
};

describe("alvesz-proposta", () => {
  it("sugere pacote premium para muitos convidados", () => {
    const pacote = suggestPacoteAlvesz(200, "Festa");
    assert.match(pacote, /Premium/i);
  });

  it("monta proposta com dados do orçamento", () => {
    const texto = buildAlveszProposta({ orcamento: baseOrcamento, cliente });
    assert.match(texto, /Maria Silva/);
    assert.match(texto, /Casamento Premium/);
    assert.match(texto, /Fazenda Vista/);
    assert.match(texto, /Bar externo/);
    assert.match(texto, /ALVESZ EXPERIENCE/i);
  });

  it("normaliza quebras para WhatsApp", () => {
    const out = formatPropostaWhatsApp("a\n\n\n\nb");
    assert.equal(out, "a\n\nb");
  });
});
