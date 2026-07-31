/**
 * Aggregate observable patterns from signals. No sensitive inference.
 */

import { MIN_SAMPLE_SIZE } from "@/lib/learning/types";
import type {
  LearningPattern,
  LearningScope,
  LearningSignal,
  LearningState,
} from "@/lib/learning/types";

function nid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

type Bucket = {
  key: string;
  title: string;
  summary: string;
  scope: LearningScope;
  supporting: LearningSignal[];
  counter: LearningSignal[];
};

const POSITIVE = new Set([
  "USEFUL",
  "ACCEPTED",
  "CONFIRMED",
  "COMPLETED",
  "PLAN_SUCCEEDED",
  "AUTOMATION_SUCCEEDED",
  "AGENT_COMPLETED",
  "RECOMMENDATION_ACCEPTED",
  "DISCOVERY_CONFIRMED",
  "CONVERSATION_RATED",
]);

const NEGATIVE = new Set([
  "NOT_USEFUL",
  "REJECTED",
  "IGNORED",
  "FAILED",
  "PLAN_FAILED",
  "AUTOMATION_FAILED",
  "AGENT_BLOCKED",
  "AGENT_PARTIAL",
  "RECOMMENDATION_REJECTED",
  "DISCOVERY_REJECTED",
]);

function scopeFor(layer: string): LearningScope {
  switch (layer) {
    case "conversation":
      return "CONVERSATION_STYLE";
    case "automation":
      return "AUTOMATION_ACTION";
    case "agent-runtime":
      return "AGENT";
    case "planner":
    case "projects":
      return "PROJECT";
    default:
      return "PERSONAL";
  }
}

export function aggregateLearningPatterns(
  state: LearningState,
  opts?: { userId: string; minSampleSize?: number; now?: string }
): { state: LearningState; patterns: LearningPattern[]; duplicatesRemoved: number } {
  const min = opts?.minSampleSize ?? MIN_SAMPLE_SIZE;
  const userId = opts?.userId;
  const signals = state.signals.filter(
    (s) => !s.softDeleted && (!userId || s.userId === userId)
  );

  const buckets = new Map<string, Bucket>();
  let duplicatesRemoved = 0;
  const seenKeys = new Set<string>();

  for (const s of signals) {
    const dedupe = `${s.sourceLayer}:${s.subjectType}:${s.signalType}`;
    // count unique subjects per pattern key
    const patternKey = `${s.sourceLayer}:${s.subjectType}:${
      POSITIVE.has(s.signalType) ? "pos" : NEGATIVE.has(s.signalType) ? "neg" : "other"
    }`;
    if (seenKeys.has(`${patternKey}:${s.subjectId}:${s.signalType}`)) {
      duplicatesRemoved += 1;
      continue;
    }
    seenKeys.add(`${patternKey}:${s.subjectId}:${s.signalType}`);

    let b = buckets.get(patternKey);
    if (!b) {
      const polarity = POSITIVE.has(s.signalType)
        ? "frequently accepted/useful"
        : NEGATIVE.has(s.signalType)
          ? "frequently rejected/failed"
          : "observed activity";
      b = {
        key: patternKey,
        title: `Padrão: ${s.sourceLayer} / ${s.subjectType}`,
        summary: `Observação neutra: ${polarity} em ${s.subjectType}.`,
        scope: scopeFor(s.sourceLayer),
        supporting: [],
        counter: [],
      };
      buckets.set(patternKey, b);
    }
    if (POSITIVE.has(s.signalType) || (!POSITIVE.has(s.signalType) && !NEGATIVE.has(s.signalType))) {
      if (patternKey.endsWith(":neg")) b.counter.push(s);
      else b.supporting.push(s);
    } else {
      b.supporting.push(s);
    }
  }

  // Attach counters from opposite polarity
  for (const [key, b] of buckets) {
    if (key.endsWith(":pos")) {
      const neg = buckets.get(key.replace(/:pos$/, ":neg"));
      if (neg) b.counter.push(...neg.supporting);
    }
    if (key.endsWith(":neg")) {
      const pos = buckets.get(key.replace(/:neg$/, ":pos"));
      if (pos) b.counter.push(...pos.supporting);
    }
  }

  const patterns: LearningPattern[] = [];
  const now = opts?.now ?? new Date().toISOString();

  for (const b of buckets.values()) {
    const sample = b.supporting.length;
    if (sample < min) continue;
    // Skip "other" low-signal noise
    if (b.key.endsWith(":other") && sample < min + 2) continue;

    const times = b.supporting.map((s) => s.occurredAt).sort();
    const confidence = Math.min(
      0.95,
      0.4 + sample * 0.08 - b.counter.length * 0.05
    );
    patterns.push({
      id: nid("pat"),
      userId: userId ?? b.supporting[0]!.userId,
      workspaceId: b.supporting[0]?.workspaceId ?? null,
      patternKey: b.key,
      title: b.title,
      summary: b.summary,
      scope: b.scope,
      signalIds: b.supporting.map((s) => s.id),
      counterSignalIds: b.counter.map((s) => s.id),
      sampleSize: sample,
      timeRange: { from: times[0]!, to: times[times.length - 1]! },
      confidence: Math.max(0.1, confidence),
      createdAt: now,
    });
  }

  // Replace patterns with same patternKey for user
  const keep = state.patterns.filter(
    (p) => p.userId !== userId || !patterns.some((n) => n.patternKey === p.patternKey)
  );

  return {
    state: { ...state, patterns: [...patterns, ...keep] },
    patterns,
    duplicatesRemoved,
  };
}
