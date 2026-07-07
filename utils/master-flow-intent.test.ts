import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeMarketCountry,
  parseIntentFromText,
  resolveMasterFlowIntent,
} from "@/utils/master-flow-intent";
import { resolveIntentV2 } from "@/utils/intent-engine-v2";

describe("master flow intent parser", () => {
  it('parseia "Quero criar um negócio de emagrecimento para mulheres 40+"', () => {
    const raw = "Quero criar um negócio de emagrecimento para mulheres 40+";
    const intent = resolveIntentV2({ raw });

    assert.equal(intent.niche, "emagrecimento");
    assert.equal(intent.country, "BR");
    assert.equal(intent.language, "pt-BR");
    assert.equal(intent.avatar, "mulheres 40+");
  });

  it("não detecta país por substring dentro de palavras (de, es)", () => {
    const parsed = parseIntentFromText("Quero criar um negócio de emagrecimento para mulheres 40+");
    assert.equal(parsed.country, "BR");
    assert.notEqual(parsed.country, "DE");
    assert.notEqual(parsed.country, "ES");
  });

  it("detecta EUA apenas com referência explícita", () => {
    const intent = resolveMasterFlowIntent({
      raw: "Quero vender um produto de emagrecimento nos EUA",
    });
    assert.equal(intent.country, "US");
    assert.equal(intent.language, "en-US");
  });

  it("detecta US como token isolado", () => {
    assert.equal(normalizeMarketCountry("US"), "US");
    assert.equal(parseIntentFromText("Produto de fitness para mercado US").country, "US");
  });

  it("detecta Espanha apenas com referência explícita", () => {
    const intent = resolveMasterFlowIntent({
      raw: "Quero vender emagrecimento na Espanha",
    });
    assert.equal(intent.country, "ES");
  });

  it("não confunde espanhol implícito sem Espanha", () => {
    const parsed = parseIntentFromText("Quero criar um negócio de bienestar para adultos");
    assert.notEqual(parsed.country, "ES");
  });

  it("extrai nicho após vender", () => {
    const parsed = parseIntentFromText("Quero vender suplementos naturais para atletas");
    assert.equal(parsed.niche, "suplementos naturais");
    assert.equal(parsed.avatar, "atletas");
  });

  it("extrai nicho após nicho de", () => {
    const parsed = parseIntentFromText("Nicho de produtividade para empreendedores");
    assert.equal(parsed.niche, "produtividade");
    assert.equal(parsed.avatar, "empreendedores");
  });

  it("default BR para frase em português sem país explícito", () => {
    const parsed = parseIntentFromText("Quero criar um produto de finanças pessoais");
    assert.equal(parsed.country, "BR");
    assert.equal(parsed.language, "pt-BR");
  });
});
