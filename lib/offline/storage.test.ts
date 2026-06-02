import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOfflineEnabledTable, OFFLINE_ENABLED_TABLES } from "./constants";

describe("offline mode", () => {
  it("enables offline for required tables", () => {
    const required = [
      "eventos",
      "growth_leads",
      "health_habits",
      "health_workouts",
      "health_meals",
      "conteudos",
    ];
    for (const table of required) {
      assert.equal(isOfflineEnabledTable(table as "eventos"), true);
      assert.ok(OFFLINE_ENABLED_TABLES.includes(table as "eventos"));
    }
    assert.equal(isOfflineEnabledTable("gastos"), false);
  });
});
