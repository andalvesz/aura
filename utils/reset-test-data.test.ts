import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isResetCountsEmpty,
  RESET_TEST_DATA_COUNT_SOURCES,
  RESET_TEST_DATA_TABLES,
} from "./reset-test-data";

describe("reset test data", () => {
  it("deletes alvesz and eventos before clientes and leads", () => {
    const alveszIdx = RESET_TEST_DATA_TABLES.indexOf("alvesz_eventos");
    const eventosIdx = RESET_TEST_DATA_TABLES.indexOf("eventos");
    const clientesIdx = RESET_TEST_DATA_TABLES.indexOf("clientes");
    const leadsIdx = RESET_TEST_DATA_TABLES.indexOf("growth_leads");
    assert.ok(alveszIdx < eventosIdx);
    assert.ok(eventosIdx < clientesIdx);
    assert.ok(eventosIdx < leadsIdx);
  });

  it("tracks required zero-count tables", () => {
    const tables = RESET_TEST_DATA_COUNT_SOURCES.map((s) => s.table);
    assert.ok(tables.includes("growth_leads"));
    assert.ok(tables.includes("eventos"));
    assert.ok(tables.includes("health_habits"));
    assert.equal(RESET_TEST_DATA_COUNT_SOURCES.length, 7);
  });

  it("detects when counts are all zero", () => {
    assert.equal(
      isResetCountsEmpty({
        leads: 0,
        eventos: 0,
        clientes: 0,
        conteudos: 0,
        habits: 0,
        workouts: 0,
        meals: 0,
      }),
      true
    );
    assert.equal(
      isResetCountsEmpty({
        leads: 1,
        eventos: 0,
        clientes: 0,
        conteudos: 0,
        habits: 0,
        workouts: 0,
        meals: 0,
      }),
      false
    );
  });
});
