/**
 * Error inbox — grouped, anonymized; no sensitive stacks in public UI.
 */

import {
  getBetaOpsState,
  newId,
  nowIso,
  setBetaOpsState,
  type BetaOpsState,
} from "@/lib/beta-ops/store";
import type { ErrorGroup, ErrorGroupStatus } from "@/lib/beta-ops/types";
import { createHash } from "node:crypto";

export function anonymizeWorkspaceId(workspaceId: string | null | undefined): string | null {
  if (!workspaceId) return null;
  return createHash("sha256").update(workspaceId).digest("hex").slice(0, 12);
}

export function groupKey(input: {
  code: string;
  route?: string | null;
  version?: string | null;
  environment?: string;
  workspaceId?: string | null;
  workspaceAnonId?: string | null;
}): string {
  const anon = input.workspaceAnonId ?? anonymizeWorkspaceId(input.workspaceId);
  return [
    input.code,
    input.route ?? "",
    input.version ?? "",
    input.environment ?? "development",
    anon ?? "",
  ].join("|");
}

export function recordErrorOccurrencePure(
  state: BetaOpsState,
  input: {
    code: string;
    route?: string | null;
    version?: string | null;
    environment?: string;
    workspaceId?: string | null;
    sampleMessage?: string;
  }
): { state: BetaOpsState; group: ErrorGroup } {
  const key = groupKey(input);
  const existing = state.errorGroups.find(
    (g) =>
      !g.softDeleted &&
      groupKey({
        code: g.code,
        route: g.route,
        version: g.version,
        environment: g.environment,
        workspaceAnonId: g.workspaceAnonId,
      }) === key
  );
  if (existing) {
    const updated: ErrorGroup = {
      ...existing,
      frequency: existing.frequency + 1,
      lastSeen: nowIso(),
      sampleMessage: (input.sampleMessage ?? existing.sampleMessage).slice(0, 240),
    };
    return {
      state: {
        ...state,
        errorGroups: state.errorGroups.map((g) => (g.id === existing.id ? updated : g)),
      },
      group: updated,
    };
  }
  const group: ErrorGroup = {
    id: newId("errg"),
    code: input.code.slice(0, 120),
    route: input.route ?? null,
    version: input.version ?? null,
    environment: input.environment ?? process.env.NODE_ENV ?? "development",
    workspaceAnonId: anonymizeWorkspaceId(input.workspaceId),
    frequency: 1,
    firstSeen: nowIso(),
    lastSeen: nowIso(),
    status: "OPEN",
    sampleMessage: (input.sampleMessage ?? input.code).slice(0, 240),
    softDeleted: false,
  };
  return { state: { ...state, errorGroups: [...state.errorGroups, group] }, group };
}

export function updateErrorGroupStatusPure(
  state: BetaOpsState,
  groupId: string,
  status: ErrorGroupStatus
): { state: BetaOpsState; ok: boolean } {
  const idx = state.errorGroups.findIndex((g) => g.id === groupId && !g.softDeleted);
  if (idx < 0) return { state, ok: false };
  const groups = [...state.errorGroups];
  groups[idx] = { ...groups[idx]!, status };
  return { state: { ...state, errorGroups: groups }, ok: true };
}

/** Public UI shape — never include stack / payload. */
export function sanitizeErrorGroupForUi(g: ErrorGroup) {
  return {
    id: g.id,
    code: g.code,
    route: g.route,
    version: g.version,
    environment: g.environment,
    workspaceAnonId: g.workspaceAnonId,
    frequency: g.frequency,
    firstSeen: g.firstSeen,
    lastSeen: g.lastSeen,
    status: g.status,
    sampleMessage: g.sampleMessage,
  };
}

export function listErrorGroups(state = getBetaOpsState()): ErrorGroup[] {
  return state.errorGroups
    .filter((g) => !g.softDeleted)
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

export function recordErrorOccurrence(input: Parameters<typeof recordErrorOccurrencePure>[1]) {
  const res = recordErrorOccurrencePure(getBetaOpsState(), input);
  setBetaOpsState(res.state);
  return res;
}
