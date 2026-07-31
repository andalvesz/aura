import type { AgentSession, AgentSessionStatus } from "@/lib/agent-runtime/types";
import { nowIso } from "@/lib/agent-runtime/store";
import { LEASE_TTL_MS } from "@/lib/agent-runtime/types";

export function classifyRecovery(
  error: string | null | undefined
):
  | "timeout"
  | "lease_expired"
  | "retryable"
  | "non_retryable"
  | "confirmation_expired"
  | "context_changed"
  | "plan_changed"
  | "member_removed"
  | "already_executed"
  | "partial" {
  const e = (error ?? "").toLowerCase();
  if (e.includes("timeout")) return "timeout";
  if (e.includes("lease")) return "lease_expired";
  if (e.includes("confirmation_expired")) return "confirmation_expired";
  if (e.includes("context_changed") || e.includes("context_version"))
    return "context_changed";
  if (e.includes("plan_changed")) return "plan_changed";
  if (e.includes("member") || e.includes("workspace_membership"))
    return "member_removed";
  if (e.includes("already_executed") || e.includes("idempoten"))
    return "already_executed";
  if (e.includes("partial")) return "partial";
  if (
    e.includes("network") ||
    e.includes("temporar") ||
    e.includes("retry") ||
    e.includes("rate")
  )
    return "retryable";
  return "non_retryable";
}

export function acquireSessionLease(
  session: AgentSession,
  owner: string,
  now = Date.now()
): { ok: true; session: AgentSession } | { ok: false; reason: string } {
  if (
    session.leaseOwner &&
    session.leaseExpiresAt &&
    Date.parse(session.leaseExpiresAt) > now &&
    session.leaseOwner !== owner
  ) {
    return { ok: false, reason: "lease_held_by_other" };
  }
  return {
    ok: true,
    session: {
      ...session,
      status: session.status === "PAUSED" ? "RUNNING" : session.status === "READY" ? "RUNNING" : session.status === "DRAFT" ? "RUNNING" : session.status,
      leaseOwner: owner,
      leaseExpiresAt: new Date(now + LEASE_TTL_MS).toISOString(),
      rowVersion: session.rowVersion + 1,
      updatedAt: nowIso(now),
    },
  };
}

export function releaseSessionLease(session: AgentSession): AgentSession {
  return {
    ...session,
    leaseOwner: null,
    leaseExpiresAt: null,
    updatedAt: nowIso(),
    rowVersion: session.rowVersion + 1,
  };
}

export function statusAfterRecovery(
  kind: ReturnType<typeof classifyRecovery>
): AgentSessionStatus {
  switch (kind) {
    case "retryable":
    case "timeout":
    case "lease_expired":
      return "PAUSED";
    case "confirmation_expired":
      return "WAITING_CONFIRMATION";
    case "context_changed":
    case "plan_changed":
      return "BLOCKED";
    case "member_removed":
      return "BLOCKED";
    case "already_executed":
      return "RUNNING";
    case "partial":
      return "PARTIAL";
    default:
      return "FAILED";
  }
}
