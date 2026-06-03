import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWaMeUrl,
  normalizeBrazilPhone,
  WHATSAPP_NO_PHONE_MESSAGE,
} from "./whatsapp";

describe("WhatsApp assistido", () => {
  it("normalizes Brazilian phones", () => {
    assert.equal(normalizeBrazilPhone("(11) 98765-4321"), "5511987654321");
    assert.equal(normalizeBrazilPhone("11987654321"), "5511987654321");
    assert.equal(normalizeBrazilPhone("5511987654321"), "5511987654321");
    assert.equal(normalizeBrazilPhone(""), null);
    assert.equal(normalizeBrazilPhone("123"), null);
  });

  it("builds wa.me links with encoded message", () => {
    const url = buildWaMeUrl("11987654321", "Olá João!");
    assert.ok(url.startsWith("https://wa.me/5511987654321?text="));
    assert.ok(url.includes(encodeURIComponent("Olá João!")));
  });

  it("exports no-phone message constant", () => {
    assert.equal(
      WHATSAPP_NO_PHONE_MESSAGE,
      "Adicione telefone para enviar no WhatsApp"
    );
  });
});
