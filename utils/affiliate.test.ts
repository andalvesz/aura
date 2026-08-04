/**
 * Affiliate Assistant tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import {
  clearBusinessExpertState,
  runAffiliateAssistant,
} from "@/lib/business-expert";

beforeEach(() => clearBusinessExpertState());

describe("Affiliate Assistant", () => {
  test("asks missing questions then completes plan", () => {
    const incomplete = runAffiliateAssistant({});
    assert.equal(incomplete.complete, false);
    assert.ok(incomplete.missingQuestions.length >= 3);

    const complete = runAffiliateAssistant({
      timeAvailable: "part-time",
      capital: "bootstrap",
      paidTraffic: false,
      organic: true,
      experience: "beginner",
      financialGoal: "R$ 2k em 90 dias",
    });
    assert.equal(complete.complete, true);
    assert.ok(complete.recommendedPlatforms.length >= 1);
    assert.ok(complete.plan?.checklist.length);
    assert.ok(complete.projectOutline?.name);
  });
});
