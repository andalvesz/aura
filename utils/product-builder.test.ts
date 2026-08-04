/**
 * Product Builder tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import {
  clearBusinessExpertState,
  runProductBuilder,
  toCorePlanDraftProposal,
} from "@/lib/business-expert";

beforeEach(() => clearBusinessExpertState());

describe("Product Builder", () => {
  test("guides intake then builds offer + plan", () => {
    const incomplete = runProductBuilder({});
    assert.equal(incomplete.complete, false);

    const full = runProductBuilder({
      problem: "Baixa conversão",
      audience: "Afiliados iniciantes",
      format: "Curso",
      ticket: "R$ 197",
      deadline: "21 dias",
    });
    assert.equal(full.complete, true);
    assert.ok(full.name);
    assert.ok(full.modules.length >= 3);
    assert.ok(full.bonuses.length >= 1);
    assert.ok(full.plan);
    const core = toCorePlanDraftProposal(full.plan!);
    assert.equal(core.sourceKind, "manual");
    assert.ok(core.steps.length >= 3);
  });
});
