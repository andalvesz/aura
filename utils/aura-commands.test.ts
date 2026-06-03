import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCommandConfirmationText,
  detectAuraCommand,
  isAuraCommandConfirmation,
} from "./aura-commands";

describe("aura commands", () => {
  it("detects financial expense command", () => {
    assert.equal(
      detectAuraCommand("Adicionar despesa de R$ 50 com gasolina"),
      "financeiro.registrar-despesa"
    );
  });

  it("detects calendar create vs read", () => {
    assert.equal(
      detectAuraCommand("Marque reunião com João amanhã às 15h"),
      "calendario.criar-evento"
    );
    assert.equal(detectAuraCommand("Minha agenda de hoje"), null);
  });

  it("detects growth and alvesz commands", () => {
    assert.equal(detectAuraCommand("Criar lead Maria Instagram"), "crescimento.criar-lead");
    assert.equal(detectAuraCommand("Novo orçamento casamento 500 convidados"), "alvesz.criar-orcamento");
  });

  it("builds expense confirmation message", () => {
    const text = buildCommandConfirmationText("financeiro.registrar-despesa", {
      titulo: "gasolina",
      valor: 50,
      categoria: "transporte",
    });
    assert.match(text, /R\$\s*50/);
    assert.match(text, /Transporte/i);
  });

  it("recognizes confirmation phrases", () => {
    assert.equal(isAuraCommandConfirmation("sim"), true);
    assert.equal(isAuraCommandConfirmation("confirmar"), true);
    assert.equal(isAuraCommandConfirmation("talvez"), false);
  });
});
