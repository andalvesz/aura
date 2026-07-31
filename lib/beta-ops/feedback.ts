/**
 * Feedback Center + bug reporting (sanitized metadata only).
 */

import {
  getBetaOpsState,
  newId,
  nowIso,
  pushOpsAudit,
  setBetaOpsState,
  type BetaOpsState,
} from "@/lib/beta-ops/store";
import type {
  FeedbackComment,
  FeedbackItem,
  FeedbackSeverity,
  FeedbackStatus,
  FeedbackTargetKind,
  FeedbackType,
} from "@/lib/beta-ops/types";
import { createOpsNotification } from "@/lib/beta-ops/notifications";

const FORBIDDEN_CONTEXT_KEYS = [
  "password",
  "token",
  "secret",
  "authorization",
  "memory",
  "document",
  "prompt",
  "conversation",
  "content",
];

export function sanitizeFeedbackContext(
  raw: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!raw) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = k.toLowerCase();
    if (FORBIDDEN_CONTEXT_KEYS.some((f) => key.includes(f))) continue;
    if (typeof v === "string" && v.length > 500) {
      out[k] = v.slice(0, 500) + "…";
    } else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = v;
    } else if (v === null) {
      out[k] = null;
    }
  }
  return out;
}

export function createFeedbackPure(
  state: BetaOpsState,
  input: {
    title: string;
    description: string;
    type: FeedbackType;
    severity?: FeedbackSeverity;
    targetKind?: FeedbackTargetKind;
    route?: string | null;
    context?: Record<string, unknown>;
    screenshotReference?: string | null;
    browserMetadata?: Record<string, string>;
    deviceMetadata?: Record<string, string>;
    correlationId?: string | null;
    createdBy: string;
    workspaceId?: string | null;
    appVersion?: string | null;
    lastErrorCode?: string | null;
    activeFeatureFlags?: string[];
  }
): { state: BetaOpsState; item: FeedbackItem } {
  const item: FeedbackItem = {
    id: newId("fb"),
    title: input.title.trim().slice(0, 200),
    description: input.description.trim().slice(0, 4000),
    type: input.type,
    severity: input.severity ?? (input.type === "BUG" ? "medium" : "low"),
    targetKind: input.targetKind ?? "general",
    route: input.route ?? null,
    context: sanitizeFeedbackContext({
      ...(input.context ?? {}),
      appVersion: input.appVersion ?? null,
      lastErrorCode: input.lastErrorCode ?? null,
      activeFeatureFlags: (input.activeFeatureFlags ?? []).slice(0, 30),
    }),
    screenshotReference: input.screenshotReference ?? null,
    browserMetadata: input.browserMetadata ?? {},
    deviceMetadata: input.deviceMetadata ?? {},
    correlationId: input.correlationId ?? null,
    status: "NEW",
    priority: 0,
    assigneeId: null,
    linkedReleaseId: null,
    duplicateOfId: null,
    internalNotes: "",
    createdBy: input.createdBy,
    workspaceId: input.workspaceId ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    softDeleted: false,
  };
  let next: BetaOpsState = { ...state, feedback: [...state.feedback, item] };
  next = pushOpsAudit(next, {
    event: input.type === "BUG" ? "bug_reported" : "feedback_submitted",
    actorId: input.createdBy,
    subjectType: "feedback",
    subjectId: item.id,
    summary: `${item.type}: ${item.title}`,
    metadata: { type: item.type, route: item.route },
    correlationId: item.correlationId,
  });
  return { state: next, item };
}

export function updateFeedbackStatusPure(
  state: BetaOpsState,
  input: {
    feedbackId: string;
    actorId: string;
    status?: FeedbackStatus;
    priority?: number;
    linkedReleaseId?: string | null;
    duplicateOfId?: string | null;
    internalNotes?: string;
    assigneeId?: string | null;
  }
): { state: BetaOpsState; ok: boolean; item: FeedbackItem | null; error?: string } {
  const idx = state.feedback.findIndex((f) => f.id === input.feedbackId && !f.softDeleted);
  if (idx < 0) return { state, ok: false, item: null, error: "not_found" };
  const cur = state.feedback[idx]!;
  const updated: FeedbackItem = {
    ...cur,
    status: input.status ?? cur.status,
    priority: input.priority ?? cur.priority,
    linkedReleaseId:
      input.linkedReleaseId !== undefined ? input.linkedReleaseId : cur.linkedReleaseId,
    duplicateOfId:
      input.duplicateOfId !== undefined ? input.duplicateOfId : cur.duplicateOfId,
    internalNotes:
      input.internalNotes !== undefined
        ? input.internalNotes.slice(0, 2000)
        : cur.internalNotes,
    assigneeId: input.assigneeId !== undefined ? input.assigneeId : cur.assigneeId,
    updatedAt: nowIso(),
  };
  const feedback = [...state.feedback];
  feedback[idx] = updated;
  let next: BetaOpsState = { ...state, feedback };
  next = pushOpsAudit(next, {
    event: "feedback_triaged",
    actorId: input.actorId,
    subjectType: "feedback",
    subjectId: updated.id,
    summary: `Feedback → ${updated.status}`,
    metadata: { status: updated.status, priority: updated.priority },
    correlationId: null,
  });
  return { state: next, ok: true, item: updated };
}

export function addFeedbackCommentPure(
  state: BetaOpsState,
  input: {
    feedbackId: string;
    authorId: string;
    body: string;
    internal: boolean;
  }
): { state: BetaOpsState; ok: boolean; comment: FeedbackComment | null; error?: string } {
  const item = state.feedback.find((f) => f.id === input.feedbackId && !f.softDeleted);
  if (!item) return { state, ok: false, comment: null, error: "not_found" };
  const comment: FeedbackComment = {
    id: newId("fbc"),
    feedbackId: input.feedbackId,
    authorId: input.authorId,
    body: input.body.trim().slice(0, 4000),
    internal: input.internal,
    createdAt: nowIso(),
    softDeleted: false,
  };
  let next: BetaOpsState = {
    ...state,
    feedbackComments: [...state.feedbackComments, comment],
  };
  if (!input.internal) {
    next = createOpsNotification(next, {
      userId: item.createdBy,
      kind: "feedback_responded",
      title: "Resposta no seu feedback",
      body: comment.body.slice(0, 200),
      href: `/dashboard/feedback?id=${item.id}`,
    });
  }
  return { state: next, ok: true, comment };
}

export function listFeedbackForUser(userId: string, state = getBetaOpsState()): FeedbackItem[] {
  return state.feedback.filter((f) => !f.softDeleted && f.createdBy === userId);
}

export function listAllFeedback(state = getBetaOpsState()): FeedbackItem[] {
  return state.feedback.filter((f) => !f.softDeleted);
}

export function getFeedbackById(
  id: string,
  userId: string,
  isAdmin: boolean,
  state = getBetaOpsState()
): FeedbackItem | null {
  const item = state.feedback.find((f) => f.id === id && !f.softDeleted) ?? null;
  if (!item) return null;
  if (!isAdmin && item.createdBy !== userId) return null;
  return item;
}

export function createFeedback(input: Parameters<typeof createFeedbackPure>[1]) {
  const res = createFeedbackPure(getBetaOpsState(), input);
  setBetaOpsState(res.state);
  return res;
}

export function updateFeedbackStatus(input: Parameters<typeof updateFeedbackStatusPure>[1]) {
  const res = updateFeedbackStatusPure(getBetaOpsState(), input);
  setBetaOpsState(res.state);
  return res;
}
