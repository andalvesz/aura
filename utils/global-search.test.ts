import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSearchResult,
  extractAuraSearchQuery,
  formatGlobalSearchReply,
  groupSearchResults,
  isAuraGlobalSearchQuery,
  paginateSearchResults,
  sortSearchResults,
} from "./global-search";

describe("global-search", () => {
  it("detecta comandos de busca natural", () => {
    assert.equal(isAuraGlobalSearchQuery("Buscar João"), true);
    assert.equal(isAuraGlobalSearchQuery("Procure Mariana"), true);
    assert.equal(isAuraGlobalSearchQuery("Busque orçamento de casamento"), true);
    assert.equal(isAuraGlobalSearchQuery("Pesquise treino"), true);
    assert.equal(isAuraGlobalSearchQuery("o que fazer hoje"), false);
  });

  it("extrai termo após verbo de busca", () => {
    assert.equal(extractAuraSearchQuery("Buscar João"), "João");
    assert.equal(extractAuraSearchQuery("Procure Mariana"), "Mariana");
    assert.equal(
      extractAuraSearchQuery("Busque orçamento de casamento"),
      "orçamento de casamento"
    );
    assert.equal(extractAuraSearchQuery("buscar  "), null);
    assert.equal(extractAuraSearchQuery("Buscar a"), null);
  });

  it("ordena por data decrescente", () => {
    const a = buildSearchResult("growth_leads", "1", "A", "2026-01-01");
    const b = buildSearchResult("clientes", "2", "B", "2026-06-01");
    const sorted = sortSearchResults([a, b]);
    assert.equal(sorted[0]?.id, "2");
  });

  it("agrupa por módulo com limite de 10", () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      buildSearchResult("growth_leads", String(i), `Lead ${i}`, `2026-01-${String(i + 1).padStart(2, "0")}`)
    );
    const groups = groupSearchResults(items);
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.moduleKey, "crescimento");
    assert.equal(groups[0]?.results.length, 10);
  });

  it("agrupa módulos distintos", () => {
    const lead = buildSearchResult("growth_leads", "1", "Mariana", "2026-03-01");
    const cliente = buildSearchResult("clientes", "2", "Mariana", "2026-03-02");
    const evento = buildSearchResult("eventos", "3", "Reunião Mariana", "2026-03-03");
    const groups = groupSearchResults([lead, cliente, evento]);
    assert.equal(groups.length, 3);
    assert.deepEqual(
      groups.map((g) => g.moduleKey),
      ["crescimento", "alvesz", "calendario"]
    );
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

  it("formata resposta agrupada por módulo", () => {
    const results = [
      buildSearchResult("growth_leads", "1", "Mariana", "2026-03-01"),
      buildSearchResult("clientes", "2", "Mariana", "2026-03-01"),
    ];
    const text = formatGlobalSearchReply(results, "Mariana", 2);
    assert.match(text, /Crescimento/);
    assert.match(text, /Alvesz/);
    assert.match(text, /Mariana/);
  });
});
