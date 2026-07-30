/**
 * RC2.1 Go-Live — collaborative visibility, concurrency, RLS policy mirrors,
 * two-user / two-workspace flow. Pure engine tests (no live Supabase).
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import {
  canViewerAccess,
  DEFAULT_VISIBILITY,
  filterByVisibility,
  mapConsentToVisibility,
  resolveCreateVisibility,
  resolveVisibilityScope,
  SHARED_WITH_SELECTED_MEMBERS_SUPPORTED,
  VISIBILITY_POLICY_SUMMARY,
} from "@/lib/aura-brain/visibility";
import {
  buildDiscoveryContextPure,
  clearDiscoveryRegistry,
  clearDiscoveryState,
  createEmptyDiscoveryState,
  ensureBuiltinDiscoveryDetectors,
  generateDiscoveriesPure,
  getDiscoveryContextForBrainPure,
  getDiscoveryPure,
  listDiscoveriesPure,
  searchAuraBrainSources,
  submitDiscoveryFeedbackPure,
  type DiscoveryArtifact,
  type DiscoveryContext,
  type DiscoveryEngineState,
} from "@/lib/discovery";
import { AURA_BRAIN_TABLE_NAMES } from "@/types/aura-brain-database";

function baseContext(): DiscoveryContext {
  return buildDiscoveryContextPure(
    { userId: "user-a", workspaceId: "ws-1", correlationId: "corr-gl" },
    {
      memories: [
        {
          id: "m1",
          memoryType: "EPISODIC",
          title: "Planejar viagem compartilhada",
          summary: "Time quer ir à Disney",
          status: "ACTIVE",
          confidence: 80,
          createdAt: "2026-07-01T10:00:00.000Z",
        },
      ],
      worldEntities: [
        {
          id: "e1",
          entityType: "PERSON",
          displayName: "Parceiro",
          status: "ACTIVE",
          confidence: 70,
        },
      ],
      worldRelationships: [],
      cognitiveArtifacts: [
        {
          id: "c1",
          artifactType: "INSIGHT",
          title: "Lacuna de orçamento",
          summary: "Faltam informações de custo",
          status: "GENERATED",
          confidence: 60,
          category: "finance",
        },
      ],
      missions: [],
      identity: [],
    }
  );
}

function seedSharedDiscovery(
  ownerId: string,
  workspaceId: string
): { state: DiscoveryEngineState; artifact: DiscoveryArtifact } {
  const ctx = baseContext();
  let state = createEmptyDiscoveryState();
  const gen = generateDiscoveriesPure(state, ctx, {
    userId: ownerId,
    workspaceId,
    maxArtifacts: 8,
  });
  assert.ok(gen.ok);
  state = gen.state;
  const artifact = state.artifacts.find(
    (a) => a.visibilityScope === "WORKSPACE"
  );
  assert.ok(artifact, "expected WORKSPACE discovery");
  return { state, artifact: artifact! };
}

beforeEach(() => {
  clearDiscoveryRegistry();
  clearDiscoveryState();
  ensureBuiltinDiscoveryDetectors();
});

describe("RC2.1 visibility policy", () => {
  test("defaults fail closed to PRIVATE", () => {
    assert.equal(DEFAULT_VISIBILITY.memory, "PRIVATE");
    assert.equal(DEFAULT_VISIBILITY.discovery_artifact, "PRIVATE");
    assert.equal(VISIBILITY_POLICY_SUMMARY.failClosed, "PRIVATE");
    assert.equal(SHARED_WITH_SELECTED_MEMBERS_SUPPORTED, false);
  });

  test("unknown scope resolves to PRIVATE", () => {
    assert.equal(resolveVisibilityScope("NOPE"), "PRIVATE");
    assert.equal(
      resolveVisibilityScope("SHARED_WITH_SELECTED_MEMBERS"),
      "PRIVATE"
    );
  });

  test("consent workspace maps to WORKSPACE; shared fails closed", () => {
    assert.equal(mapConsentToVisibility("workspace"), "WORKSPACE");
    assert.equal(mapConsentToVisibility("shared"), "PRIVATE");
    assert.equal(mapConsentToVisibility("personal"), "PRIVATE");
  });

  test("PRIVATE never projects without explicit share", () => {
    const scope = resolveCreateVisibility({
      kind: "memory",
      activeContext: "workspace",
      workspaceId: "ws-1",
      shareWithWorkspace: false,
    });
    assert.equal(scope, "PRIVATE");
  });

  test("explicit shareWithWorkspace yields WORKSPACE", () => {
    const scope = resolveCreateVisibility({
      kind: "memory",
      activeContext: "workspace",
      workspaceId: "ws-1",
      shareWithWorkspace: true,
    });
    assert.equal(scope, "WORKSPACE");
  });

  test("owner reads own; member reads WORKSPACE; non-member denied", () => {
    assert.equal(
      canViewerAccess({
        viewerUserId: "a",
        ownerUserId: "a",
        visibilityScope: "PRIVATE",
        workspaceId: null,
      }),
      true
    );
    assert.equal(
      canViewerAccess({
        viewerUserId: "b",
        ownerUserId: "a",
        visibilityScope: "WORKSPACE",
        workspaceId: "ws-1",
        viewerWorkspaceId: "ws-1",
        isWorkspaceMember: true,
      }),
      true
    );
    assert.equal(
      canViewerAccess({
        viewerUserId: "c",
        ownerUserId: "a",
        visibilityScope: "WORKSPACE",
        workspaceId: "ws-1",
        viewerWorkspaceId: "ws-2",
        isWorkspaceMember: false,
      }),
      false
    );
    assert.equal(
      canViewerAccess({
        viewerUserId: "b",
        ownerUserId: "a",
        visibilityScope: "PRIVATE",
        workspaceId: "ws-1",
        isWorkspaceMember: true,
      }),
      false
    );
  });

  test("removed member loses access (isWorkspaceMember false)", () => {
    assert.equal(
      canViewerAccess({
        viewerUserId: "b",
        ownerUserId: "a",
        visibilityScope: "WORKSPACE",
        workspaceId: "ws-1",
        viewerWorkspaceId: "ws-1",
        isWorkspaceMember: false,
      }),
      false
    );
  });

  test("suppression does not cross workspace via filter", () => {
    const items = [
      {
        userId: "a",
        workspaceId: "ws-1",
        visibilityScope: "WORKSPACE" as const,
      },
      {
        userId: "a",
        workspaceId: "ws-2",
        visibilityScope: "WORKSPACE" as const,
      },
    ];
    const filtered = filterByVisibility(items, {
      userId: "b",
      workspaceId: "ws-1",
      isWorkspaceMember: true,
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]!.workspaceId, "ws-1");
  });
});

describe("RC2.1 collaborative discovery flow", () => {
  test("user B sees workspace discovery created by user A", () => {
    const { state, artifact } = seedSharedDiscovery("user-a", "ws-1");
    const forB = listDiscoveriesPure(state, "user-b", {
      workspaceId: "ws-1",
      includeArchived: true,
    });
    assert.ok(forB.some((a) => a.id === artifact.id));
    const got = getDiscoveryPure(state, "user-b", artifact.id, "ws-1");
    assert.ok(got);
    assert.equal(got!.executionInfluence, "none");
  });

  test("user B cannot see private discovery of A in other workspace", () => {
    let state = createEmptyDiscoveryState();
    const privateArt: DiscoveryArtifact = {
      ...(seedSharedDiscovery("user-a", "ws-1").artifact),
      id: "dsc_private_only",
      userId: "user-a",
      workspaceId: "ws-personal",
      visibilityScope: "PRIVATE",
      rowVersion: 1,
    };
    state = {
      ...createEmptyDiscoveryState(),
      artifacts: [privateArt],
    };
    const leaked = listDiscoveriesPure(state, "user-b", {
      workspaceId: "ws-1",
    });
    assert.equal(
      leaked.find((a) => a.id === "dsc_private_only"),
      undefined
    );
  });

  test("user B feedback is visible in history for user A", () => {
    let { state, artifact } = seedSharedDiscovery("user-a", "ws-1");
    const fb = submitDiscoveryFeedbackPure(state, {
      userId: "user-b",
      workspaceId: "ws-1",
      discoveryId: artifact.id,
      kind: "confirm",
      note: "faz sentido para o time",
      expectedVersion: artifact.rowVersion,
    });
    assert.ok(fb.ok);
    state = fb.state;
    assert.equal(state.feedbacks[0]!.actorUserId, "user-b");
    assert.equal(state.feedbacks[0]!.kind, "confirm");
    assert.ok(state.audits.some((a) => a.userId === "user-b"));
    assert.equal(fb.data!.artifact.executionInfluence, "none");
    assert.equal(
      fb.data!.artifact.metadata.confirmationIsNotFact,
      true
    );
  });

  test("concurrent confirm/reject — second write conflicts on version", () => {
    let { state, artifact } = seedSharedDiscovery("user-a", "ws-1");
    const v = artifact.rowVersion;
    const first = submitDiscoveryFeedbackPure(state, {
      userId: "user-a",
      workspaceId: "ws-1",
      discoveryId: artifact.id,
      kind: "confirm",
      expectedVersion: v,
    });
    assert.ok(first.ok);
    state = first.state;
    const second = submitDiscoveryFeedbackPure(state, {
      userId: "user-b",
      workspaceId: "ws-1",
      discoveryId: artifact.id,
      kind: "reject",
      note: "discordo",
      expectedVersion: v,
    });
    assert.equal(second.ok, false);
    assert.equal(second.data?.conflict, true);
    assert.match(second.error ?? "", /Conflito/);
    // History of first write preserved
    assert.ok(state.feedbacks.some((f) => f.kind === "confirm"));
  });

  test("concurrent archive then suppress — last write wins with bumped version", () => {
    let { state, artifact } = seedSharedDiscovery("user-a", "ws-1");
    const a1 = submitDiscoveryFeedbackPure(state, {
      userId: "user-a",
      workspaceId: "ws-1",
      discoveryId: artifact.id,
      kind: "archive",
      expectedVersion: artifact.rowVersion,
    });
    assert.ok(a1.ok);
    state = a1.state;
    const nextVersion = a1.data!.artifact.rowVersion;
    const a2 = submitDiscoveryFeedbackPure(state, {
      userId: "user-b",
      workspaceId: "ws-1",
      discoveryId: artifact.id,
      kind: "suppress_similar",
      expectedVersion: nextVersion,
    });
    assert.ok(a2.ok);
    assert.equal(a2.data!.artifact.status, "SUPPRESSED");
    assert.ok(a2.data!.artifact.rowVersion > nextVersion);
  });

  test("two workspaces stay isolated", () => {
    const ws1 = seedSharedDiscovery("user-a", "ws-1");
    const ws2 = seedSharedDiscovery("user-a", "ws-2");
    const merged: DiscoveryEngineState = {
      ...createEmptyDiscoveryState(),
      artifacts: [...ws1.state.artifacts, ...ws2.state.artifacts],
    };
    const onlyWs1 = listDiscoveriesPure(merged, "user-b", {
      workspaceId: "ws-1",
      includeArchived: true,
    });
    assert.ok(onlyWs1.every((a) => a.workspaceId === "ws-1"));
    assert.ok(onlyWs1.some((a) => a.id === ws1.artifact.id));
    assert.equal(
      onlyWs1.find((a) => a.id === ws2.artifact.id),
      undefined
    );
  });

  test("Brain context never exposes executionInfluence other than none", () => {
    const { state } = seedSharedDiscovery("user-a", "ws-1");
    const brain = getDiscoveryContextForBrainPure(state, "user-a", {
      workspaceId: "ws-1",
      limit: 5,
    });
    assert.equal(brain.executionInfluence, "none");
  });

  test("search respects visibility — private of A not in B results sources", () => {
    const results = searchAuraBrainSources(
      "segredo",
      {
        memories: [{ id: "m-priv", title: "segredo privado", summary: "x" }],
        discoveries: [],
      },
      10
    );
    // Search itself is over already-filtered sources; assert helper scores
    assert.ok(results.length >= 1);
    // Policy: callers must filter sources first — documented via filterByVisibility
    const filtered = filterByVisibility(
      [
        {
          userId: "user-a",
          workspaceId: null,
          visibilityScope: "PRIVATE" as const,
        },
      ],
      { userId: "user-b", isWorkspaceMember: false }
    );
    assert.equal(filtered.length, 0);
  });

  test("enumerable IDs do not grant access without visibility", () => {
    const { state, artifact } = seedSharedDiscovery("user-a", "ws-1");
    const privateClone: DiscoveryArtifact = {
      ...artifact,
      id: "dsc_guessable",
      visibilityScope: "PRIVATE",
      workspaceId: null,
      userId: "user-a",
    };
    const poisoned = {
      ...state,
      artifacts: [...state.artifacts, privateClone],
    };
    assert.equal(
      getDiscoveryPure(poisoned, "user-b", "dsc_guessable", "ws-1"),
      null
    );
  });
});

describe("RC2.1 DB types inventory", () => {
  test("official brain tables are listed for regeneration checklist", () => {
    assert.ok(AURA_BRAIN_TABLE_NAMES.includes("aura_discovery_artifacts"));
    assert.ok(AURA_BRAIN_TABLE_NAMES.includes("aura_memories"));
    assert.ok(AURA_BRAIN_TABLE_NAMES.includes("aura_identity_claims"));
    assert.ok(AURA_BRAIN_TABLE_NAMES.includes("aura_world_entities"));
    assert.ok(AURA_BRAIN_TABLE_NAMES.includes("aura_cognitive_artifacts"));
  });
});
