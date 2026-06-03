import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatDate,
  formatSafeDate,
  formatSafeTime,
  formatTime,
  isToday,
  isValidDate,
} from "./format";

describe("format — datas inválidas", () => {
  it("isValidDate rejeita valores vazios ou inválidos", () => {
    assert.equal(isValidDate(null), false);
    assert.equal(isValidDate(undefined), false);
    assert.equal(isValidDate(""), false);
    assert.equal(isValidDate("Invalid Date"), false);
    assert.equal(isValidDate("not-a-date"), false);
    assert.equal(isValidDate(new Date("invalid")), false);
  });

  it("isValidDate aceita ISO válido", () => {
    assert.equal(isValidDate("2026-06-03T15:00:00.000Z"), true);
    assert.equal(isValidDate("2026-06-03"), true);
  });

  it("formatSafeDate e formatSafeTime não lançam RangeError", () => {
    assert.equal(formatSafeDate(null), "Data não definida");
    assert.equal(formatSafeTime(""), "Horário não definido");
    assert.doesNotThrow(() => formatSafeDate("garbage"));
    assert.doesNotThrow(() => formatSafeTime("garbage"));
  });

  it("formatDate e formatTime retornam fallback", () => {
    assert.equal(formatDate(""), "Data não definida");
    assert.equal(formatTime(""), "Horário não definido");
  });

  it("isToday retorna false para data inválida", () => {
    assert.equal(isToday(""), false);
    assert.equal(isToday("invalid"), false);
  });
});
