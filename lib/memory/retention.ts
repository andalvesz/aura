/**
 * Retention policies — deterministic expiry only (no smart decay).
 */

import type { MemoryRecord, RetentionPolicy } from "@/lib/memory/types";

const MS_DAY = 86_400_000;

export function defaultRetentionFor(input: {
  memoryType: string;
  sensitivity: string;
  confirmed: boolean;
  sourceType: string;
}): RetentionPolicy {
  if (input.confirmed) return "user_managed";
  if (input.sensitivity === "RESTRICTED" || input.sensitivity === "SENSITIVE") {
    return "short_term";
  }
  if (input.sourceType === "search_or_browse" || input.sourceType === "system_observation") {
    return "session";
  }
  if (input.memoryType === "SEMANTIC") return "long_term";
  if (input.memoryType === "PROCEDURAL") return "long_term";
  if (input.memoryType === "REFLECTIVE") return "standard";
  return "standard";
}

export function computeValidUntil(
  policy: RetentionPolicy,
  fromIso: string,
  explicitUntil?: string | null
): string | null {
  if (policy === "permanent" || policy === "user_managed") return null;
  if (policy === "until_date") return explicitUntil ?? null;
  const from = Date.parse(fromIso);
  if (!Number.isFinite(from)) return null;
  switch (policy) {
    case "session":
      return new Date(from + MS_DAY).toISOString();
    case "short_term":
      return new Date(from + 30 * MS_DAY).toISOString();
    case "standard":
      return new Date(from + 180 * MS_DAY).toISOString();
    case "long_term":
      return new Date(from + 730 * MS_DAY).toISOString();
    default:
      return null;
  }
}

export function isExpired(memory: MemoryRecord, now = Date.now()): boolean {
  if (memory.status === "CONFIRMED" && memory.retentionPolicy === "user_managed") {
    return false;
  }
  if (memory.status === "CONFIRMED" && memory.retentionPolicy === "permanent") {
    return false;
  }
  if (!memory.validUntil) return false;
  const t = Date.parse(memory.validUntil);
  return Number.isFinite(t) && t <= now;
}

export function shouldHardDelete(memory: MemoryRecord): boolean {
  return (
    memory.status === "DELETED" &&
    memory.retentionPolicy !== "permanent" &&
    memory.metadata?.hardDeleteEligible === true
  );
}
