/**
 * Personality helpers — communication prefs only (not Identity Engine).
 */

import {
  DEFAULT_AURA_PERSONALITY,
  type AuraPersonality,
  type CommunicationLanguage,
  type CommunicationTone,
} from "@/lib/orchestrator/types";

const TONES: CommunicationTone[] = [
  "direct",
  "warm",
  "formal",
  "coach",
  "concise",
];

const LANGS: CommunicationLanguage[] = ["pt-BR", "en", "es"];

export function normalizePersonality(
  partial?: Partial<AuraPersonality> | null
): AuraPersonality {
  const tone = partial?.tone && TONES.includes(partial.tone) ? partial.tone : DEFAULT_AURA_PERSONALITY.tone;
  const language =
    partial?.language && LANGS.includes(partial.language)
      ? partial.language
      : DEFAULT_AURA_PERSONALITY.language;

  return {
    style: (partial?.style ?? DEFAULT_AURA_PERSONALITY.style).trim() || DEFAULT_AURA_PERSONALITY.style,
    objectives: (partial?.objectives ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 12),
    preferences: (partial?.preferences ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 12),
    language,
    tone,
  };
}

export function formatWithPersonality(
  message: string,
  personality: AuraPersonality
): string {
  const prefix =
    personality.tone === "formal"
      ? "Prezado,"
      : personality.tone === "warm"
        ? "Oi,"
        : personality.tone === "coach"
          ? "Vamos juntos:"
          : null;

  const body =
    personality.tone === "concise"
      ? message.replace(/\s+/g, " ").trim().slice(0, 280)
      : message.trim();

  if (!prefix) return body;
  return `${prefix} ${body}`;
}

export { TONES as PERSONALITY_TONES, LANGS as PERSONALITY_LANGUAGES };
