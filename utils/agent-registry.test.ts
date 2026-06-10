import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAgentOwnerReply,
  isAuraBrainAgentRoutingQuery,
  selectAgentsForQuery,
} from "./agent-registry";

describe("Aura Agent Registry", () => {
  it("selects revenue bundle for international money questions", () => {
    const agents = selectAgentsForQuery("Como ganhar US$ 10.000?");
    assert.ok(agents.includes("global"));
    assert.ok(agents.includes("money"));
    assert.ok(agents.includes("creator"));
    assert.ok(agents.includes("marketing"));
    assert.ok(agents.includes("ceo"));
  });

  it("routes strategic revenue questions to multi-agent brain", () => {
    assert.equal(
      isAuraBrainAgentRoutingQuery("Como ganhar US$ 10.000?"),
      true
    );
  });

  it("builds agent owner reply", () => {
    const text = buildAgentOwnerReply("Como ganhar US$ 10.000?");
    assert.match(text, /Aura Brain consultaria/);
    assert.match(text, /Money Agent/);
    assert.match(text, /Global Agent/);
  });

  it("detects performance agent for metrics questions", () => {
    const agents = selectAgentsForQuery("Como melhorar o ROAS da campanha?");
    assert.ok(agents.includes("performance"));
    assert.ok(agents.includes("marketing"));
  });
});
