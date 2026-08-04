/**
 * Business modes tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import {
  clearBusinessExpertState,
  getBusinessMode,
  listBusinessModes,
  recommendModes,
  setBusinessMode,
  ensureBusinessProfile,
} from "@/lib/business-expert";

beforeEach(() => clearBusinessExpertState());

describe("Business Modes", () => {
  test("lists eight modes and can activate", () => {
    const modes = listBusinessModes();
    assert.equal(modes.length, 8);
    for (const id of [
      "afiliado",
      "produtor",
      "prestador",
      "agencia",
      "startup",
      "empresa-local",
      "creator",
      "freelancer",
    ] as const) {
      assert.ok(getBusinessMode(id));
    }
    const rec = recommendModes({
      capital: "bootstrap",
      prefersDigital: true,
    });
    assert.ok(rec.length >= 1);
    const profile = setBusinessMode("u1", "afiliado");
    assert.equal(profile.activeMode, "afiliado");
    assert.equal(ensureBusinessProfile("u1").activeMode, "afiliado");
  });
});
