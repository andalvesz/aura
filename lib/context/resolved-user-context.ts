/**
 * Immutable server-side user context for multiuser cognitive isolation.
 * Client never chooses actorUserId / subjectUserId.
 */

import { createHash } from "node:crypto";

export type VisibilityScope = "PRIVATE" | "PERSONAL" | "WORKSPACE" | "SYSTEM";

export type ContextType = "personal" | "workspace";

export type ResolvedUserContext = Readonly<{
  actorUserId: string;
  subjectUserId: string;
  workspaceId: string | null;
  contextType: ContextType;
  visibilityScope: VisibilityScope;
  role: string | null;
  correlationId: string;
}>;

export class PersonalSubjectViolation extends Error {
  readonly code = "PERSONAL_SUBJECT_VIOLATION";

  constructor(message: string) {
    super(message);
    this.name = "PersonalSubjectViolation";
  }
}

export class CrossUserContextBlock extends Error {
  readonly code = "CROSS_USER_CONTEXT_BLOCKED";

  constructor(message: string) {
    super(message);
    this.name = "CrossUserContextBlock";
  }
}

/** Short non-reversible hash for safe diagnostics (never log full IDs in prod UI). */
export function shortUserIdHash(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 12);
}

export function newCorrelationId(): string {
  return `ctx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Build resolved context from auth.uid() (actor).
 * subjectUserId defaults to actor — never the workspace owner.
 */
export function buildResolvedUserContext(input: {
  actorUserId: string;
  workspaceId?: string | null;
  contextType?: ContextType;
  role?: string | null;
  /** Only for explicit authorized impersonation / admin flows */
  subjectUserId?: string;
  correlationId?: string;
}): ResolvedUserContext {
  const actorUserId = input.actorUserId;
  const subjectUserId = input.subjectUserId ?? actorUserId;
  const contextType =
    input.contextType ??
    (input.workspaceId ? "workspace" : "personal");
  const visibilityScope: VisibilityScope =
    contextType === "workspace" ? "WORKSPACE" : "PRIVATE";

  return Object.freeze({
    actorUserId,
    subjectUserId,
    workspaceId: contextType === "workspace" ? (input.workspaceId ?? null) : null,
    contextType,
    visibilityScope,
    role: input.role ?? null,
    correlationId: input.correlationId ?? newCorrelationId(),
  });
}

/**
 * Personal modules (health, workout, diet, identity, personal memory, etc.)
 * MUST operate only on auth.uid() as subject.
 */
export function assertPersonalSubject(context: ResolvedUserContext): void {
  if (context.actorUserId !== context.subjectUserId) {
    throw new PersonalSubjectViolation(
      "Módulos pessoais exigem subjectUserId = auth.uid(); impersonação bloqueada."
    );
  }
}

/**
 * Block payloads that try to inject another user's identity into prompts/context.
 */
export function assertNoCrossUserPayload(
  context: ResolvedUserContext,
  payloadUserId: string | null | undefined
): void {
  if (!payloadUserId) return;
  if (payloadUserId !== context.actorUserId && payloadUserId !== context.subjectUserId) {
    throw new CrossUserContextBlock(
      "Payload contém userId de outro usuário; bloqueado."
    );
  }
}

export function logContextResolved(
  context: ResolvedUserContext,
  extras?: {
    personalRecordsLoadedCount?: number;
    workspaceRecordsLoadedCount?: number;
    cacheNamespace?: string;
    crossUserBlocked?: boolean;
  }
): void {
  console.info("[context_resolved]", {
    context_scope: context.visibilityScope,
    context_type: context.contextType,
    actor_hash: shortUserIdHash(context.actorUserId),
    subject_hash: shortUserIdHash(context.subjectUserId),
    subject_user_match: context.actorUserId === context.subjectUserId,
    workspace_present: Boolean(context.workspaceId),
    correlation_id: context.correlationId,
    personal_records_loaded_count: extras?.personalRecordsLoadedCount ?? null,
    workspace_records_loaded_count: extras?.workspaceRecordsLoadedCount ?? null,
    cache_namespace: extras?.cacheNamespace ?? null,
    cross_user_blocked: extras?.crossUserBlocked ?? false,
  });
}

/** Cache key fragment — always include user + scope. */
export function personalCacheNamespace(
  feature: string,
  context: ResolvedUserContext,
  version = "v1"
): string {
  return `aura:${feature}:${context.subjectUserId}:${context.workspaceId ?? "personal"}:${context.visibilityScope}:${version}`;
}
