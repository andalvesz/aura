export type WinnerPatternEntry = {
  label: string;
  score?: number | null;
  insight?: string | null;
  recommendation?: string | null;
  source?: string | null;
};

export type WinnerContext = {
  headlines: WinnerPatternEntry[];
  offers: WinnerPatternEntry[];
  creatives: WinnerPatternEntry[];
  countries: WinnerPatternEntry[];
  niches: WinnerPatternEntry[];
};

export type WinnerContextFilters = {
  niche?: string | null;
  country?: string | null;
  module?: string;
};

export const WINNER_PATTERN_PROMPT_INTRO =
  "Utilize os padrões vencedores abaixo como referência.";

export function emptyWinnerContext(): WinnerContext {
  return {
    headlines: [],
    offers: [],
    creatives: [],
    countries: [],
    niches: [],
  };
}

export function isWinnerContextEmpty(context: WinnerContext): boolean {
  return (
    context.headlines.length === 0 &&
    context.offers.length === 0 &&
    context.creatives.length === 0 &&
    context.countries.length === 0 &&
    context.niches.length === 0
  );
}

export function dedupeWinnerEntries(entries: WinnerPatternEntry[]): WinnerPatternEntry[] {
  const seen = new Set<string>();
  const result: WinnerPatternEntry[] = [];

  for (const entry of entries) {
    const key = entry.label.trim().toLowerCase().slice(0, 120);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }

  return result;
}

function formatWinnerEntry(entry: WinnerPatternEntry): string {
  const parts = [`• ${entry.label}`];
  if (entry.score != null) parts.push(`(score ${entry.score})`);
  if (entry.insight) parts.push(`— ${entry.insight}`);
  else if (entry.recommendation) parts.push(`— ${entry.recommendation}`);
  return parts.join(" ");
}

function formatWinnerSection(title: string, entries: WinnerPatternEntry[]): string | null {
  if (entries.length === 0) return null;
  return [title, ...entries.map(formatWinnerEntry)].join("\n");
}

export function buildWinnerPatternPromptBlock(context: WinnerContext): string {
  if (isWinnerContextEmpty(context)) return "";

  const sections = [
    WINNER_PATTERN_PROMPT_INTRO,
    formatWinnerSection("Headlines vencedoras:", context.headlines),
    formatWinnerSection("Ofertas vencedoras:", context.offers),
    formatWinnerSection("Criativos vencedores:", context.creatives),
    formatWinnerSection("Países vencedores:", context.countries),
    formatWinnerSection("Nichos vencedores:", context.niches),
  ].filter(Boolean);

  return sections.join("\n\n");
}

export function logWinnerPatternInjected(module: string, context: WinnerContext): void {
  console.info("[winner-pattern] injected", {
    module,
    headlines: context.headlines.length,
    offers: context.offers.length,
    creatives: context.creatives.length,
    countries: context.countries.length,
    niches: context.niches.length,
  });
}

export function logWinnerPatternApplied(module: string): void {
  console.info("[winner-pattern] applied", { module });
}

export function applyWinnerPatternToSystemPrompt(
  systemPrompt: string,
  promptBlock: string,
  module: string
): string {
  if (!promptBlock.trim()) return systemPrompt;
  logWinnerPatternApplied(module);
  return `${systemPrompt}\n\n${promptBlock}`;
}
