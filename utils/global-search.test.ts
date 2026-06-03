import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSearchResult,
  extractAuraSearchQuery,
  formatGlobalSearchReply,
  isAuraGlobalSearchQuery,
  paginateSearchResults,
  sortSearchResults,
} from "./global-search";

describe("global-search", () => {
  it("detecta comando Buscar", () => {
    assert.equal(isAuraGlobalSearchQuery("Buscar João"), true);
    assert.equal(isAuraGlobalSearchQuery("buscar maria casamento"), true);
    assert.equal(isAuraGlobalSearchQuery("o que fazer hoje"), false);
  });

  it("extrai termo após Buscar", () => {
    assert.equal(extractAuraSearchQuery("Buscar João"), "João");
    assert.equal(extractAuraSearchQuery("buscar  "), null);
    assert.equal(extractAuraSearchQuery("Buscar a"), null);
  });

  it("ordena por data decrescente", () => {
    const a = buildSearchResult("growth_leads", "1", "A", "2026-01-01");
    const b = buildSearchResult("clientes", "2", "B", "2026-06-01");
    const sorted = sortSearchResults([a, b]);
    assert.equal(sorted[0]?.id, "2");
  });

  it("pagina resultados", () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      buildSearchResult("gastos", String(i), `G${i}`, "2026-01-01")
    );
    const { slice, hasMore } = paginateSearchResults(items, 0, 3);
    assert.equal(slice.length, 3);
    assert.equal(hasMore, true);
  });

  it("formata resposta vazia", () => {
    const text = formatGlobalSearchReply([], "xyz", 0);
    assert.match(text, /Nenhum resultado/);
  });

  it("formata resposta com itens", () => {
    const results = [
      buildSearchResult("growth_leads", "1", "João Casamento", "2026-03-01"),
    ];
    const text = formatGlobalSearchReply(results, "João", 1);
    assert.match(text, /\[Lead\]/);
    assert.match(text, /João Casamento/);
  });
});
