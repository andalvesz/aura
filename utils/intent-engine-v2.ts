import {
  parseIntentFromText,
  resolveMasterFlowIntent,
  type MasterFlowIntent,
  type MasterFlowIntentInput,
} from "@/utils/master-flow-intent";

const NICHE_FILLER_PATTERN =
  /^(?:(?:um|uma)\s+)?(?:(?:produto|curso|programa|método|metodo|sistema|treinamento)\s+(?:de|sobre|para)\s+)+/i;

const NICHE_TRAILING_COUNTRY =
  /\s+(?:nos?|nas?|no|na|em)\s+(?:eua|usa|estados\s+unidos|brasil|br|united\s+states).*$/i;

export function sanitizeNicheV2(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let niche = raw.trim();
  niche = niche.replace(NICHE_FILLER_PATTERN, "").trim();
  niche = niche.replace(NICHE_TRAILING_COUNTRY, "").trim();
  niche = niche.replace(/^(?:de|sobre|para)\s+/i, "").trim();
  return niche.length >= 2 ? niche : raw.trim();
}

export function resolveIntentV2(input?: MasterFlowIntentInput | null): MasterFlowIntent {
  const parsed = input?.raw?.trim() ? parseIntentFromText(input.raw) : {};
  const merged: MasterFlowIntentInput = { ...parsed, ...input };

  const base = resolveMasterFlowIntent(merged);
  const niche = sanitizeNicheV2(merged.niche ?? base.niche) ?? base.niche;

  return { ...base, niche };
}

export function intentConfidenceV2(intent: MasterFlowIntent): number {
  let score = 0;
  if (intent.niche) score += 35;
  if (intent.country) score += 25;
  if (intent.language) score += 15;
  if (intent.avatar) score += 10;
  if (intent.ticket) score += 10;
  if (intent.raw) score += 5;
  return Math.min(100, score);
}
