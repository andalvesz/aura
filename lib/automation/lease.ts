/**
 * Lease + concurrency helpers for Automation Engine V1.
 */

import { LEASE_TTL_MS, type Automation } from "@/lib/automation/types/types";

export function acquireLease(
  automation: Automation,
  owner: string,
  now = Date.now(),
  ttlMs = LEASE_TTL_MS
): { ok: true; automation: Automation } | { ok: false; reason: string } {
  if (automation.status === "RUNNING") {
    if (
      automation.leaseOwner &&
      automation.leaseExpiresAt &&
      Date.parse(automation.leaseExpiresAt) > now
    ) {
      if (automation.leaseOwner !== owner) {
        return { ok: false, reason: "lease_held_by_other" };
      }
    }
    // expired lease — recoverable
  }

  if (
    automation.leaseOwner &&
    automation.leaseExpiresAt &&
    Date.parse(automation.leaseExpiresAt) > now &&
    automation.leaseOwner !== owner
  ) {
    return { ok: false, reason: "lease_held_by_other" };
  }

  return {
    ok: true,
    automation: {
      ...automation,
      status: "RUNNING",
      leaseOwner: owner,
      leaseExpiresAt: new Date(now + ttlMs).toISOString(),
      executionAttempt: automation.executionAttempt + 1,
      rowVersion: automation.rowVersion + 1,
      updatedAt: new Date(now).toISOString(),
      executionInfluence: "executed",
    },
  };
}

export function releaseLease(
  automation: Automation,
  now = Date.now()
): Automation {
  return {
    ...automation,
    leaseOwner: null,
    leaseExpiresAt: null,
    updatedAt: new Date(now).toISOString(),
  };
}

export function conditionalUpdate(
  current: Automation,
  expectedRowVersion: number,
  patch: Partial<Automation>
): { ok: true; automation: Automation } | { ok: false; reason: string } {
  if (current.rowVersion !== expectedRowVersion) {
    return { ok: false, reason: "row_version_conflict" };
  }
  return {
    ok: true,
    automation: {
      ...current,
      ...patch,
      rowVersion: current.rowVersion + 1,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function hashPayload(input: Record<string, unknown>): string {
  const raw = JSON.stringify(sortKeys(input));
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
  }
  return `h${(h >>> 0).toString(16)}`;
}

function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    const v = obj[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sortKeys(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
