/**
 * Marketplace registry tests.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  compareMarketplaces,
  getMarketplace,
  listMarketplaces,
  marketplacesWithAffiliates,
} from "@/lib/business-expert";

describe("Marketplaces registry", () => {
  test("registers required platforms with full schema", () => {
    const list = listMarketplaces();
    assert.ok(list.length >= 13);
    for (const id of [
      "kiwify",
      "hotmart",
      "eduzz",
      "braip",
      "herospark",
      "monetizze",
      "ticto",
      "kirvano",
      "gumroad",
      "shopify",
      "woocommerce",
      "stripe",
      "mercado-pago",
    ] as const) {
      const m = getMarketplace(id);
      assert.ok(m, id);
      assert.ok(m!.name);
      assert.ok(m!.description);
      assert.ok(m!.useCases.length);
      assert.ok(typeof m!.checkout === "boolean");
      assert.ok(typeof m!.affiliates === "boolean");
      assert.ok(m!.documentation);
      assert.ok(m!.futureIntegrations);
    }
    assert.ok(marketplacesWithAffiliates().length >= 5);
    const cmp = compareMarketplaces("kiwify", "hotmart");
    assert.ok(cmp);
    assert.equal(cmp!.needsWebResearch, true);
  });
});
