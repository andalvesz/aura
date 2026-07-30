/**
 * In-memory + sanitizing audit trail for Aura Brain.
 * Persist via service when DB available; never log secrets.
 */

import type {
  ActionExecutionStatus,
  ActionRiskLevel,
  AutonomyLevel,
  AuraBrainAuditEntry,
  AuraBrainContextMode,
} from "@/lib/aura-brain/types";

const SENSITIVE_KEY =
  /password|token|secret|authorization|api[_-]?key|credit|card|cvv|refresh/i;

export function sanitizeAuditInput(
  input: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!input) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = "[redacted]";
      continue;
    }
    if (typeof v === "string" && v.length > 500) {
      out[k] = `${v.slice(0, 500)}…`;
      continue;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitizeAuditInput(v as Record<string, unknown>);
      continue;
    }
    out[k] = v;
  }
  return out;
}

let seq = 0;

export function createAuditEntry(params: {
  userId: string;
  workspaceId?: string | null;
  context: AuraBrainContextMode;
  source: string;
  planId?: string | null;
  actionId?: string | null;
  automationId?: string | null;
  autonomyLevel: AutonomyLevel;
  riskLevel?: ActionRiskLevel | null;
  input?: Record<string, unknown>;
  status: AuraBrainAuditEntry["status"];
  error?: string | null;
  undoAvailable?: boolean;
}): AuraBrainAuditEntry {
  seq += 1;
  const now = new Date().toISOString();
  return {
    id: `audit-${Date.now()}-${seq}`,
    userId: params.userId,
    workspaceId: params.workspaceId ?? null,
    context: params.context,
    source: params.source,
    planId: params.planId ?? null,
    actionId: params.actionId ?? null,
    automationId: params.automationId ?? null,
    autonomyLevel: params.autonomyLevel,
    riskLevel: params.riskLevel ?? null,
    inputSummary: sanitizeAuditInput(params.input),
    status: params.status,
    error: params.error ?? null,
    createdAt: now,
    completedAt:
      params.status === "executed" ||
      params.status === "failed" ||
      params.status === "undone"
        ? now
        : null,
    undoAvailable: params.undoAvailable ?? false,
  };
}

/** Session buffer for recent audits (tests + UI before DB hydrate) */
const recentByUser = new Map<string, AuraBrainAuditEntry[]>();

export function pushAuditEntry(entry: AuraBrainAuditEntry): void {
  const list = recentByUser.get(entry.userId) ?? [];
  list.unshift(entry);
  recentByUser.set(entry.userId, list.slice(0, 100));
}

export function listRecentAudits(userId: string, limit = 20): AuraBrainAuditEntry[] {
  return (recentByUser.get(userId) ?? []).slice(0, limit);
}

export function clearAuditBuffer(userId?: string): void {
  if (!userId) {
    recentByUser.clear();
    return;
  }
  recentByUser.delete(userId);
}

export function markAuditStatus(
  userId: string,
  auditId: string,
  status: ActionExecutionStatus,
  error?: string | null
): AuraBrainAuditEntry | null {
  const list = recentByUser.get(userId) ?? [];
  const idx = list.findIndex((a) => a.id === auditId);
  if (idx < 0) return null;
  const updated: AuraBrainAuditEntry = {
    ...list[idx]!,
    status,
    error: error ?? null,
    completedAt: new Date().toISOString(),
  };
  list[idx] = updated;
  recentByUser.set(userId, list);
  return updated;
}
