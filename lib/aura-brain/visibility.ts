/**
 * Aura Brain visibility scopes — RC2.1 / ADR-007.
 *
 * PRIVATE data must never project to workspace without an explicit rule.
 * When scope cannot be determined safely → PRIVATE.
 */

export const VISIBILITY_SCOPES = [
  "PRIVATE",
  "WORKSPACE",
  "SHARED_WITH_SELECTED_MEMBERS",
  "SYSTEM_INTERNAL",
] as const;

export type VisibilityScope = (typeof VISIBILITY_SCOPES)[number];

/** ADR-007 legacy consent labels mapped to RC2.1 scopes */
export type ConsentScopeLegacy =
  | "personal"
  | "workspace"
  | "shared"
  | "system";

/**
 * SHARED_WITH_SELECTED_MEMBERS is reserved. There is no member-list ACL UI yet.
 * Do not emit this scope from writers until real support exists.
 */
export const SHARED_WITH_SELECTED_MEMBERS_SUPPORTED = false;

export type BrainResourceKind =
  | "memory"
  | "world_entity"
  | "world_relationship"
  | "cognitive_artifact"
  | "discovery_artifact"
  | "feedback"
  | "suppression"
  | "timeline"
  | "identity_claim"
  | "run"
  | "audit";

/** Default scope when creating a resource without an explicit choice */
export const DEFAULT_VISIBILITY: Record<BrainResourceKind, VisibilityScope> = {
  memory: "PRIVATE",
  world_entity: "PRIVATE",
  world_relationship: "PRIVATE",
  cognitive_artifact: "PRIVATE",
  discovery_artifact: "PRIVATE",
  feedback: "PRIVATE",
  suppression: "PRIVATE",
  timeline: "PRIVATE",
  identity_claim: "PRIVATE",
  run: "PRIVATE",
  audit: "SYSTEM_INTERNAL",
};

/**
 * When the active context is a workspace AND the user explicitly shares,
 * these kinds may default to WORKSPACE.
 */
export const WORKSPACE_SHAREABLE_KINDS: ReadonlySet<BrainResourceKind> = new Set([
  "memory",
  "world_entity",
  "world_relationship",
  "cognitive_artifact",
  "discovery_artifact",
  "feedback",
  "suppression",
  "timeline",
]);

export function isVisibilityScope(value: unknown): value is VisibilityScope {
  return (
    typeof value === "string" &&
    (VISIBILITY_SCOPES as readonly string[]).includes(value)
  );
}

export function mapConsentToVisibility(
  consent: ConsentScopeLegacy | string | null | undefined
): VisibilityScope {
  switch (consent) {
    case "workspace":
      return "WORKSPACE";
    case "shared":
      // No selected-members ACL yet — fail closed.
      return SHARED_WITH_SELECTED_MEMBERS_SUPPORTED
        ? "SHARED_WITH_SELECTED_MEMBERS"
        : "PRIVATE";
    case "system":
      return "SYSTEM_INTERNAL";
    case "personal":
    default:
      return "PRIVATE";
  }
}

export function mapVisibilityToConsent(
  scope: VisibilityScope
): ConsentScopeLegacy {
  switch (scope) {
    case "WORKSPACE":
      return "workspace";
    case "SHARED_WITH_SELECTED_MEMBERS":
      return "shared";
    case "SYSTEM_INTERNAL":
      return "system";
    case "PRIVATE":
    default:
      return "personal";
  }
}

/**
 * Resolve a safe visibility. Unknown / unsupported values → PRIVATE.
 * SHARED_WITH_SELECTED_MEMBERS without real support → PRIVATE.
 */
export function resolveVisibilityScope(
  raw: unknown,
  fallback: VisibilityScope = "PRIVATE"
): VisibilityScope {
  if (!isVisibilityScope(raw)) return fallback;
  if (
    raw === "SHARED_WITH_SELECTED_MEMBERS" &&
    !SHARED_WITH_SELECTED_MEMBERS_SUPPORTED
  ) {
    return "PRIVATE";
  }
  return raw;
}

/**
 * Explicit share into workspace. Never infer from membership alone.
 */
export function resolveCreateVisibility(input: {
  kind: BrainResourceKind;
  explicit?: VisibilityScope | ConsentScopeLegacy | null;
  activeContext?: "personal" | "workspace";
  workspaceId?: string | null;
  /** User must opt-in to share with the workspace */
  shareWithWorkspace?: boolean;
}): VisibilityScope {
  if (input.explicit != null) {
    if (isVisibilityScope(input.explicit)) {
      return resolveVisibilityScope(input.explicit);
    }
    return mapConsentToVisibility(String(input.explicit));
  }

  if (
    input.shareWithWorkspace === true &&
    input.activeContext === "workspace" &&
    Boolean(input.workspaceId) &&
    WORKSPACE_SHAREABLE_KINDS.has(input.kind)
  ) {
    return "WORKSPACE";
  }

  return DEFAULT_VISIBILITY[input.kind] ?? "PRIVATE";
}

export type VisibilityAccessInput = {
  viewerUserId: string;
  ownerUserId: string;
  visibilityScope: VisibilityScope;
  workspaceId: string | null;
  /** Active workspace of the viewer (membership assumed pre-validated by RLS/service) */
  viewerWorkspaceId?: string | null;
  /** Viewer is an active member of the resource workspace */
  isWorkspaceMember?: boolean;
  /** Reserved for future selected-members ACL */
  selectedMemberIds?: string[] | null;
};

/**
 * Application-level visibility gate (mirrors intended RLS).
 * Fail closed when unsure.
 */
export function canViewerAccess(input: VisibilityAccessInput): boolean {
  const scope = resolveVisibilityScope(input.visibilityScope);

  if (scope === "SYSTEM_INTERNAL") {
    // System rows are never projected to product UIs for other users.
    return input.viewerUserId === input.ownerUserId;
  }

  if (input.viewerUserId === input.ownerUserId) return true;

  if (scope === "PRIVATE") return false;

  if (scope === "WORKSPACE") {
    if (!input.workspaceId) return false;
    if (input.isWorkspaceMember === false) return false;
    if (
      input.viewerWorkspaceId != null &&
      input.viewerWorkspaceId !== input.workspaceId
    ) {
      return false;
    }
    return input.isWorkspaceMember === true;
  }

  if (scope === "SHARED_WITH_SELECTED_MEMBERS") {
    if (!SHARED_WITH_SELECTED_MEMBERS_SUPPORTED) return false;
    const ids = input.selectedMemberIds ?? [];
    return ids.includes(input.viewerUserId);
  }

  return false;
}

/** Filter helpers for search / timeline / list */
export function filterByVisibility<
  T extends {
    userId: string;
    workspaceId?: string | null;
    visibilityScope?: VisibilityScope | null;
  },
>(
  items: T[],
  viewer: {
    userId: string;
    workspaceId?: string | null;
    isWorkspaceMember?: boolean;
  }
): T[] {
  return items.filter((item) =>
    canViewerAccess({
      viewerUserId: viewer.userId,
      ownerUserId: item.userId,
      visibilityScope: resolveVisibilityScope(
        item.visibilityScope,
        item.workspaceId && viewer.workspaceId === item.workspaceId
          ? "WORKSPACE"
          : "PRIVATE"
      ),
      workspaceId: item.workspaceId ?? null,
      viewerWorkspaceId: viewer.workspaceId ?? null,
      isWorkspaceMember: viewer.isWorkspaceMember,
    })
  );
}

export const VISIBILITY_POLICY_SUMMARY = {
  defaults: DEFAULT_VISIBILITY,
  sharedWithSelectedMembersSupported: SHARED_WITH_SELECTED_MEMBERS_SUPPORTED,
  rule: "Never project PRIVATE → WORKSPACE without explicit shareWithWorkspace or explicit scope.",
  failClosed: "PRIVATE",
} as const;
