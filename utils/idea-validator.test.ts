/**
 * Idea Validator tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import {
  clearBusinessExpertState,
  validateBusinessIdea,
} from "@/lib/business-expert";

beforeEach(() => clearBusinessExpertState());

describe("Idea Validator", () => {
  test("scores ideas and returns structured fields", () => {
    const weak = validateBusinessIdea({ idea: "app" });
    assert.ok(weak.score < 70);
    assert.ok(weak.weaknesses.length >= 1);
    assert.ok(weak.nextSteps.length >= 3);

    const strong = validateBusinessIdea({
      idea: "Mentoria de vendas B2B para agências digitais com método de 8 semanas",
      audience: "donos de agência 3–20 pessoas",
      market: "serviços de marketing BR",
      capital: "low",
      time: "part-time",
      experience: "intermediate",
    });
    assert.ok(strong.score >= 50);
    assert.ok(strong.strengths.length >= 1);
    assert.ok(strong.risks.length >= 1);
    assert.ok(strong.opportunities.length >= 1);
    assert.ok(strong.recommendation.length > 10);
    assert.ok(["low", "medium", "high", "very-high"].includes(strong.difficulty));
  });
});
