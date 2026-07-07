import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runOpportunityEngine } from "@/lib/opportunity/opportunity-engine";
import {
  computeRealityPenalty,
  computeRealityScore,
  filterAnglesByReality,
  isOpportunityCompatible,
  parseRealityProfile,
  runRealityOnAngles,
} from "@/utils/reality-engine";
import { buildOpportunityAngles, runBusinessReasoning } from "@/utils/business-reasoning";

describe("reality engine — profile parsing", () => {
  it("extracts capital, time, experience and team from conversation", () => {
    const profile = parseRealityProfile(
      "Tenho R$500, 2h por dia, sou iniciante, estou sozinho, quero ganhar R$5.000 por mês"
    );

    assert.equal(profile.availableCapital, 500);
    assert.equal(profile.timeHoursPerDay, 2);
    assert.equal(profile.experience, "iniciante");
    assert.equal(profile.team, "sozinho");
    assert.ok(profile.confidence >= 40);
  });

  it("detects profession and audience", () => {
    const profile = parseRealityProfile(
      "Sou advogado, já tenho audiência, tenho R$2.000 para começar"
    );

    assert.equal(profile.profession, "Advogado");
    assert.equal(profile.hasAudience, true);
    assert.equal(profile.availableCapital, 2000);
  });

  it("detects no-appearance preference", () => {
    const profile = parseRealityProfile("Não quero aparecer, tenho R$1.000");
    assert.equal(profile.wantsToAppear, false);
  });
});

describe("reality engine — score", () => {
  it("returns low score for constrained profile (example ~42)", () => {
    const profile = parseRealityProfile(
      "Tenho R$500, 2h por dia, iniciante, sozinho, quero ganhar R$5.000"
    );
    const score = computeRealityScore(profile);

    assert.ok(score >= 30 && score <= 55, `expected ~42 range, got ${score}`);
  });

  it("returns higher score for well-resourced profile", () => {
    const low = computeRealityScore(
      parseRealityProfile("Tenho R$500, 2h por dia, iniciante, sozinho")
    );
    const high = computeRealityScore(
      parseRealityProfile(
        "Tenho R$20.000, 8h por dia, avançado, tenho equipe, sei programar, já tenho audiência"
      )
    );

    assert.ok(high > low);
    assert.ok(high >= 65);
  });
});

describe("reality engine — compatibility filtering", () => {
  it("blocks SaaS when capital is R$500", () => {
    const profile = parseRealityProfile("Tenho R$500, 2h por dia, iniciante, sozinho");
    const score = computeRealityScore(profile);

    assert.equal(isOpportunityCompatible("saas", profile, score), false);
    assert.ok(computeRealityPenalty("saas", profile) >= 50);
  });

  it("allows service for low-capital beginner", () => {
    const profile = parseRealityProfile("Tenho R$200, iniciante, sozinho");
    const score = computeRealityScore(profile);

    assert.equal(isOpportunityCompatible("servico", profile, score), true);
  });

  it("filters incompatible angles before ranking", () => {
    const reasoning = runBusinessReasoning(
      "SaaS de automação para atendimento — tenho R$500, 2h/dia, iniciante"
    );
    const angles = buildOpportunityAngles(reasoning);
    const profile = parseRealityProfile(reasoning.raw);
    const score = computeRealityScore(profile);

    const { compatible, eliminated } = filterAnglesByReality(angles, profile, score);

    assert.ok(compatible.length >= 3);
    assert.ok(eliminated.some((m) => m === "SaaS" || eliminated.length > 0));
    assert.ok(compatible.every((a) => a.businessModel.id !== "saas" || score >= 65));
  });
});

describe("reality engine — opportunity integration", () => {
  it("returns reality summary in engine result", () => {
    const result = runOpportunityEngine(
      "Tenho R$500, 2h por dia, iniciante, sozinho — quero ganhar R$5.000 com IA"
    );

    assert.ok(result.reality);
    assert.ok(result.reality.realityScore < 55);
    assert.ok(result.reality.realityChecks.length > 0);
    assert.ok(result.reality.businessPath.length >= 5);
    assert.ok(result.reality.evolutionPlan.length === 5);
    assert.ok(result.reality.pathRecommendation.length === 5);
  });

  it("does not recommend SaaS in TOP 3 for R$500 profile", () => {
    const result = runOpportunityEngine(
      "Tenho apenas R$500, 2h por dia, sou iniciante e estou sozinho. Quero ganhar R$5.000."
    );

    const models = result.recommendations.map((r) => r.businessModel);
    assert.ok(!models.includes("SaaS"), `SaaS should be filtered, got: ${models.join(", ")}`);
    assert.ok(result.recommendations.every((r) => r.constraints.minimumCapital <= 5000));
    assert.ok(result.recommendations.every((r) => r.realityCompatible));
  });

  it("attaches constraints to each recommendation", () => {
    const result = runOpportunityEngine("Tenho R$2.000, quero ganhar R$10.000 por mês");

    for (const rec of result.recommendations) {
      assert.ok(rec.constraints.minimumCapital >= 0);
      assert.ok(rec.constraints.cashGenerationSpeed >= 0);
      assert.ok(typeof rec.realityPenalty === "number");
    }
  });
});

describe("reality engine — runRealityOnAngles", () => {
  it("re-ranks angles toward cash-first models for low score", () => {
    const reasoning = runBusinessReasoning("Quero ganhar R$10.000 com SaaS e IA");
    const angles = buildOpportunityAngles(reasoning);
    const goal =
      "Tenho R$500, 2h por dia, iniciante, sozinho — quero ganhar R$10.000 com SaaS";

    const { rankedAngles, reality } = runRealityOnAngles(goal, angles);

    assert.ok(reality.realityScore < 55);
    const topModel = rankedAngles[0]?.businessModel.id;
    assert.ok(
      topModel === "servico" ||
        topModel === "templates" ||
        topModel === "kit" ||
        topModel === "mentoria" ||
        topModel === "consultoria",
      `expected conservative model, got ${topModel}`
    );
  });
});
