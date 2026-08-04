/**
 * Web research provider bridge — NO crawler in Business Expert.
 * Delegates to Aura web research when configured; never invents fresh market numbers.
 */

import type { WebResearchRequest, WebResearchStatus } from "@/lib/business-expert/types";

export type AuraWebResearchHit = {
  title: string;
  snippet: string;
  url?: string;
  asOf?: string;
};

export type AuraWebResearchProvider = {
  id: string;
  available: boolean;
  search: (query: string) => AuraWebResearchHit[] | Promise<AuraWebResearchHit[]>;
};

let activeProvider: AuraWebResearchProvider | null = null;

export function registerBusinessWebResearchProvider(
  provider: AuraWebResearchProvider | null
): void {
  activeProvider = provider;
}

export function getBusinessWebResearchProvider(): AuraWebResearchProvider | null {
  return activeProvider;
}

export function createMissingWebResearchProvider(): AuraWebResearchProvider {
  return {
    id: "missing",
    available: false,
    search: () => [],
  };
}

/**
 * Prefer this for platform comparisons and "current fees" style questions.
 */
export function requestBusinessWebResearch(input: {
  query: string;
  reason: string;
  required?: boolean;
}): WebResearchRequest {
  const provider = activeProvider;
  const disclaimer =
    "Business Expert não inventa dados recentes de mercado. Comparações de taxas/rankings devem usar fonte atualizada via provider de pesquisa do Aura quando disponível.";

  if (!provider || !provider.available) {
    return {
      query: input.query,
      reason: input.reason,
      status: "provider_missing",
      results: [],
      disclaimer,
    };
  }

  const raw = provider.search(input.query);
  if (raw && typeof (raw as Promise<unknown>).then === "function") {
    // Async providers are marked ready with empty results; caller can await separately.
    return {
      query: input.query,
      reason: input.reason,
      status: "ready",
      results: [],
      disclaimer: `${disclaimer} Provider assíncrono registrado (${provider.id}) — integrar await no orchestrator do Aura.`,
    };
  }

  const hits = raw as AuraWebResearchHit[];
  const status: WebResearchStatus =
    hits.length === 0 ? "stale_static_only" : "ready";

  return {
    query: input.query,
    reason: input.reason,
    status,
    results: hits.map((h) => ({
      title: h.title,
      snippet: h.snippet,
      url: h.url,
      asOf: h.asOf,
    })),
    disclaimer,
  };
}

export function shouldPreferWebResearch(message: string): boolean {
  return (
    /kiwify|hotmart|eduzz|taxa|comiss[aã]o|ranking|melhor\s+plataforma|vs\.?|versus/i.test(
      message
    ) || /hoje|atual|202[4-9]|pre[cç]o\s+da\s+plataforma/i.test(message)
  );
}
