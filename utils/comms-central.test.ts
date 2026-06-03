import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCommsCentralReply, detectCommsCentralQuery } from "./comms-central";

describe("comms central", () => {
  it("detects aura central comms questions", () => {
    assert.equal(detectCommsCentralQuery("Tenho respostas de clientes?"), "client-responses");
    assert.equal(
      detectCommsCentralQuery("Quais propostas ainda não tiveram retorno?"),
      "propostas-sem-retorno"
    );
    assert.equal(
      detectCommsCentralQuery("Quais clientes devo contatar hoje?"),
      "contatar-hoje"
    );
    assert.equal(detectCommsCentralQuery("Como está minha meta?"), null);
  });

  it("builds reply for contact today", () => {
    const text = buildCommsCentralReply({
      query: "contatar-hoje",
      logs: [],
      leads: [],
      orcamentos: [],
      clientes: [],
      gmailConnected: false,
      recentInboundCount: 0,
    });
    assert.match(text, /Contatos de hoje|Pipeline em dia/);
  });
});
