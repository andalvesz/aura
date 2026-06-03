import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAuraMentorGlobalSummaryAction,
  isAuraMentorGlobalSummaryQuery,
} from "./mentor";

describe("aura mentor global summary detection", () => {
  it("detects global summary actions", () => {
    assert.equal(isAuraMentorGlobalSummaryAction("meu-dia"), true);
    assert.equal(isAuraMentorGlobalSummaryAction("resumo-global"), true);
    assert.equal(isAuraMentorGlobalSummaryAction("analisar-leads"), false);
  });

  it("detects natural language global queries", () => {
    assert.equal(isAuraMentorGlobalSummaryQuery("O que fazer hoje?"), true);
    assert.equal(isAuraMentorGlobalSummaryQuery("Resumo do dia"), true);
    assert.equal(isAuraMentorGlobalSummaryQuery("Minha agenda"), true);
    assert.equal(isAuraMentorGlobalSummaryQuery("Prioridades"), true);
    assert.equal(isAuraMentorGlobalSummaryQuery("Meu dia"), true);
  });

  it("does not treat CRM prioritization as global summary", () => {
    assert.equal(
      isAuraMentorGlobalSummaryQuery(
        "Priorizar oportunidades com base nos meus leads"
      ),
      false
    );
    assert.equal(isAuraMentorGlobalSummaryQuery("analisar leads"), false);
  });

  it("detects calendar action as global summary", () => {
    assert.equal(isAuraMentorGlobalSummaryQuery("", "calendario-hoje"), true);
    assert.equal(isAuraMentorGlobalSummaryQuery("", "dashboard-executivo"), true);
  });

  it("keeps deep calendar queries separate", () => {
    assert.equal(
      isAuraMentorGlobalSummaryQuery("Quais follow-ups tenho esta semana?"),
      false
    );
  });
});
