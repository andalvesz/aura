/**
 * Experience Layer — validate, normalize, forward.
 * Does NOT decide truth, importance, or permanence.
 */

import type {
  ExperienceRecord,
  ExperienceType,
  MemorySourceType,
  RecordExperienceInput,
  SourceReference,
} from "@/lib/memory/types";

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** Deterministic fingerprint for dedupe / idempotency. */
export function experienceFingerprint(input: {
  userId: string;
  workspaceId: string | null;
  experienceType: ExperienceType;
  sourceType: MemorySourceType;
  sourceReference: SourceReference | null;
  subjectType: string | null;
  subjectId: string | null;
  context: string;
  payload: Record<string, unknown>;
  occurredAtDay: string;
}): string {
  const raw = [
    input.userId,
    input.workspaceId ?? "",
    input.experienceType,
    input.sourceType,
    input.sourceReference
      ? `${input.sourceReference.entityType}:${input.sourceReference.entityId}`
      : "",
    input.subjectType ?? "",
    input.subjectId ?? "",
    input.context,
    stableStringify(input.payload),
    input.occurredAtDay,
  ].join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return `fp-${hash.toString(16)}`;
}

export function validateExperienceInput(
  input: RecordExperienceInput
): { ok: true } | { ok: false; reason: string } {
  if (!input.experienceType?.trim()) {
    return { ok: false, reason: "experienceType obrigatório" };
  }
  if (!input.sourceType?.trim()) {
    return { ok: false, reason: "sourceType obrigatório" };
  }
  if (input.payload && typeof input.payload !== "object") {
    return { ok: false, reason: "payload deve ser objeto" };
  }
  return { ok: true };
}

/**
 * Normalize an experience. Does not materialize memory.
 */
export function normalizeExperience(
  userId: string,
  input: RecordExperienceInput
): ExperienceRecord {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const occurredAtDay = occurredAt.slice(0, 10);
  const payload = input.payload ?? {};
  const sourceReference = input.sourceReference ?? null;
  const workspaceId = input.workspaceId ?? null;
  const context = input.context?.trim() || "general";
  const fingerprint = experienceFingerprint({
    userId,
    workspaceId,
    experienceType: input.experienceType,
    sourceType: input.sourceType,
    sourceReference,
    subjectType: input.subjectType ?? null,
    subjectId: input.subjectId ?? null,
    context,
    payload,
    occurredAtDay,
  });

  return {
    id: uid("exp"),
    userId,
    workspaceId,
    experienceType: input.experienceType,
    occurredAt,
    sourceType: input.sourceType,
    sourceReference,
    actorType: input.actorType ?? "system",
    actorId: input.actorId ?? null,
    subjectType: input.subjectType ?? null,
    subjectId: input.subjectId ?? null,
    context,
    payload,
    sensitivity: input.sensitivity ?? "STANDARD",
    consentScope: input.consentScope ?? "personal",
    idempotencyKey: input.idempotencyKey ?? null,
    correlationId: input.correlationId ?? null,
    fingerprint,
    createdAt: new Date().toISOString(),
  };
}

/** Map experience type → suggested memory type (hint only). */
export function suggestMemoryTypeFromExperience(
  experienceType: ExperienceType
): "EPISODIC" | "SEMANTIC" | "PROCEDURAL" | "REFLECTIVE" {
  switch (experienceType) {
    case "preference_changed":
    case "identity_claim_confirmed":
    case "identity_claim_rejected":
    case "user_statement":
      return "SEMANTIC";
    case "manual_memory_entry":
      return "SEMANTIC";
    case "planner_recommendation_ignored":
    case "planner_recommendation_accepted":
    case "user_feedback":
      return "REFLECTIVE";
    default:
      return "EPISODIC";
  }
}
