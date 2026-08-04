/**
 * Business Advisor production tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import {
  answerBusinessQuestion,
  adviseBusiness,
  buildBusinessContext,
  clearBusinessExpertState,
  ensureBusinessProfile,
  listMarketplaces,
  upsertBusinessProfile,
} from "@/lib/business-expert";

beforeEach(() => clearBusinessExpertState());

describe("Business Advisor B1.X", () => {
  test("answers platform and growth questions", () => {
    upsertBusinessProfile({
      userId: "u1",
      capital: "low",
      experience: "beginner",
      interestAreas: ["marketing", "vendas"],
    });
    const profile = ensureBusinessProfile("u1");
    const ctx = buildBusinessContext({ profile });
    const a = answerBusinessQuestion("Qual melhor plataforma para vender meu curso?", ctx);
    assert.equal(a.intent, "platform_compare");
    assert.ok(a.needsWebResearch);
    assert.ok(a.suggestedMarketplaces.length >= 1);

    const b = adviseBusiness("grow", ctx, "Como crescer?");
    assert.ok(b.recommendations.length >= 1);
    assert.ok(listMarketplaces().length >= 13);
  });
});
