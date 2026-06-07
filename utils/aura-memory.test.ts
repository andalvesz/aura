import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAuraMemoryTitle,
  resolveAuraMemoryCategoria,
  shouldPersistAuraMemory,
} from "./aura-memory";
import {
  isMemoryLeadPriorityQuery,
  isMemoryRecallQuery,
  isMemoryRecommendationQuery,
  isMemorySalesPlanQuery,
} from "./memory";

describe("aura-memory", () => {
  it("persiste treinos e coach", () => {
    assert.equal(shouldPersistAuraMemory("Treino de peito", { kind: "treino" }), true);
    assert.equal(shouldPersistAuraMemory("Prioridades...", { kind: "coach" }), true);
    assert.equal(shouldPersistAuraMemory("ok", { kind: "chat" }), false);
  });

  it("resolve categorias por módulo", () => {
    assert.equal(resolveAuraMemoryCategoria("saude", { kind: "treino" }), "saude");
    assert.equal(resolveAuraMemoryCategoria("social", { kind: "roteiro" }), "social_media");
    assert.equal(resolveAuraMemoryCategoria("aura_central", { kind: "coach" }), "coach");
    assert.equal(
      resolveAuraMemoryCategoria("aura_central", { module: "crescimento", kind: "chat" }),
      "crescimento"
    );
  });

  it("gera títulos por tipo", () => {
    assert.equal(
      buildAuraMemoryTitle("saude", "criar treino", { kind: "treino" }),
      "Treino sugerido"
    );
    assert.equal(
      buildAuraMemoryTitle("aura_central", "coach", {
        kind: "coach",
        coachMode: "opportunity",
      }),
      "Oportunidade recomendada"
    );
  });

  it("detecta perguntas de memória", () => {
    assert.equal(isMemoryRecommendationQuery("O que você me recomendou ontem?"), true);
    assert.equal(isMemoryLeadPriorityQuery("Qual lead eu deveria priorizar?"), true);
    assert.equal(isMemorySalesPlanQuery("Qual plano de vendas foi gerado?"), true);
    assert.equal(isMemoryRecallQuery("Qual treino você criou para mim?"), true);
  });
});
