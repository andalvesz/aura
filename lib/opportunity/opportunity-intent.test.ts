import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runOpportunityEngine } from "@/lib/opportunity/opportunity-engine";
import { parseOpportunityIntent } from "@/lib/opportunity/opportunity-intent";
import { runBusinessReasoning } from "@/utils/business-reasoning";

describe("opportunity intent — extraction (legacy signals)", () => {
  it("extracts technology and avatar for IA + pequenos negócios", () => {
    const intent = parseOpportunityIntent("IA para pequenos negócios");
    assert.equal(intent.technology, "Inteligência Artificial");
    assert.equal(intent.avatar, "Pequenos negócios");
    assert.ok(intent.confidence >= 50);
  });

  it("extracts Excel as technology", () => {
    const intent = parseOpportunityIntent("Curso de Excel para analistas");
    assert.equal(intent.technology, "Excel");
  });
});

describe("business reasoning integration", () => {
  it("IA para pequenos negócios prioriza automação e ferramenta IA", () => {
    const reasoning = runBusinessReasoning(
      "Quero ganhar R$10.000 por mês usando IA para pequenos negócios"
    );

    assert.equal(reasoning.technology, "Inteligência Artificial");
    assert.equal(reasoning.market, "Pequenos negócios (PME)");
    assert.ok(
      reasoning.primaryProblem.includes("automação") ||
        reasoning.primaryProblem.includes("manual")
    );
    assert.ok(
      ["Ferramenta IA", "Automação", "SaaS"].includes(reasoning.recommendedBusinessModel)
    );
  });

  it("engine returns 3 problem-driven opportunities with business models", () => {
    const result = runOpportunityEngine("Quero ganhar R$30.000 por mês");

    assert.equal(result.recommendations.length, 3);
    assert.ok(result.reasoning.primaryProblem);
    assert.ok(result.reasoning.recommendedBusinessModel);

    for (const rec of result.recommendations) {
      assert.ok(rec.problem);
      assert.ok(rec.businessModel);
      assert.ok(rec.reason.includes(rec.businessModel));
    }
  });

  it("perdem clientes identifica problema de retenção", () => {
    const reasoning = runBusinessReasoning("Comunidade para empreendedores que perdem clientes");
    assert.equal(reasoning.primaryProblem, "Perder clientes");
    assert.equal(reasoning.recommendedBusinessModel, "Comunidade");
    assert.ok(reasoning.confidence >= 35);
  });
});
