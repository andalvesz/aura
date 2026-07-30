/**
 * RC4 Projects & Business OS — unit tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import { clearProjectsState, getProjectsState, setProjectsState, projectsStoreKey } from "@/lib/projects/store";
import { createEmptyProjectsState } from "@/lib/projects/types";
import {
  addProjectMemberPure,
  createProjectPure,
  findProjectForMemoryPure,
  getProjectPure,
  groupProjectsByStatus,
  linkMemoryToProjectPure,
  listProjectTimelinePure,
  listProjectsPure,
  removeProjectMemberPure,
  searchProjectsPure,
  setProjectStatusPure,
  unlinkMemoryFromProjectPure,
  updateProjectPure,
  canEditProject,
  canViewProject,
} from "@/lib/projects";
import { createBusinessPure, listBusinessesPure, searchBusinessesPure } from "@/lib/projects/business";
import {
  addProjectDocumentPure,
  listProjectDocumentsPure,
  searchProjectDocumentsPure,
} from "@/lib/projects/documents";
import {
  filterDiscoveriesForProject,
  groupDiscoveriesByType,
} from "@/lib/projects/discovery";
import { addCommentPure, listCommentsPure } from "@/lib/daily/engine";
import { createEmptyDailyOpsState } from "@/lib/daily/types";
import { canViewerAccess } from "@/lib/aura-brain/visibility";
import type { DiscoveryArtifact } from "@/lib/discovery/types";

beforeEach(() => {
  clearProjectsState();
});

function baseState() {
  return createEmptyProjectsState();
}

describe("RC4 Projects", () => {
  test("create project with defaults and timeline", () => {
    const res = createProjectPure(baseState(), {
      name: "Lançamento App",
      description: "MVP",
      ownerUserId: "u1",
    });
    assert.equal(res.error, null);
    assert.ok(res.project);
    assert.equal(res.project!.status, "idea");
    assert.equal(res.project!.members[0].role, "owner");
    assert.equal(res.state.timeline[0].kind, "project_created");
    assert.equal(res.project!.favorite, false);
  });

  test("update status and kanban grouping", () => {
    let state = baseState();
    const created = createProjectPure(state, {
      name: "A",
      ownerUserId: "u1",
    });
    state = created.state;
    const moved = setProjectStatusPure(
      state,
      "u1",
      created.project!.id,
      "active"
    );
    assert.equal(moved.project?.status, "active");
    const board = groupProjectsByStatus(
      listProjectsPure(moved.state, "u1", { includeArchived: true })
    );
    assert.equal(board.active.length, 1);
    assert.equal(board.idea.length, 0);
  });

  test("memory belongs to at most one project", () => {
    let state = baseState();
    const a = createProjectPure(state, { name: "P1", ownerUserId: "u1" });
    state = a.state;
    const b = createProjectPure(state, { name: "P2", ownerUserId: "u1" });
    state = b.state;
    state = linkMemoryToProjectPure(state, "u1", a.project!.id, "mem1").state;
    state = linkMemoryToProjectPure(state, "u1", b.project!.id, "mem1").state;
    assert.equal(findProjectForMemoryPure(state, "mem1")?.id, b.project!.id);
    assert.equal(
      getProjectPure(state, "u1", a.project!.id)?.memoryIds.includes("mem1"),
      false
    );
    state = unlinkMemoryFromProjectPure(state, "u1", b.project!.id, "mem1").state;
    assert.equal(findProjectForMemoryPure(state, "mem1"), null);
  });

  test("search projects by name and tags", () => {
    let state = baseState();
    const created = createProjectPure(state, {
      name: "Viagem Europa",
      tags: ["travel"],
      ownerUserId: "u1",
    });
    state = created.state;
    const hits = searchProjectsPure(state, "u1", "europa");
    assert.equal(hits.length, 1);
  });
});

describe("RC4 Members & RLS mirrors", () => {
  test("owner adds editor/viewer; editor can edit; viewer cannot", () => {
    let state = baseState();
    const created = createProjectPure(state, {
      name: "Collab",
      ownerUserId: "owner",
    });
    state = created.state;
    const add = addProjectMemberPure(
      state,
      "owner",
      created.project!.id,
      "editor1",
      "editor"
    );
    assert.equal(add.error, null);
    state = add.state;
    const viewer = addProjectMemberPure(
      state,
      "owner",
      created.project!.id,
      "viewer1",
      "viewer"
    );
    state = viewer.state;
    const project = getProjectPure(state, "owner", created.project!.id)!;
    assert.equal(canEditProject(project, "editor1"), true);
    assert.equal(canEditProject(project, "viewer1"), false);
    assert.equal(canViewProject(project, "viewer1"), true);

    const denied = updateProjectPure(state, "viewer1", {
      projectId: created.project!.id,
      name: "Hack",
    });
    assert.ok(denied.error);

    const removed = removeProjectMemberPure(
      state,
      "owner",
      created.project!.id,
      "viewer1"
    );
    assert.equal(removed.error, null);
  });

  test("workspace visibility gate", () => {
    assert.equal(
      canViewerAccess({
        viewerUserId: "u2",
        ownerUserId: "u1",
        visibilityScope: "WORKSPACE",
        workspaceId: "ws",
        viewerWorkspaceId: "ws",
        isWorkspaceMember: true,
      }),
      true
    );
  });
});

describe("RC4 Comments on project", () => {
  test("comment target project", () => {
    let daily = createEmptyDailyOpsState();
    const res = addCommentPure(daily, {
      userId: "u1",
      targetType: "project",
      targetId: "prj_1",
      body: "Vamos alinhar o escopo",
      visibilityScope: "PRIVATE",
    });
    daily = res.state;
    const list = listCommentsPure(
      daily,
      { userId: "u1", workspaceId: null, isWorkspaceMember: false },
      "project",
      "prj_1"
    );
    assert.equal(list.length, 1);
  });
});

describe("RC4 Timeline & Documents", () => {
  test("timeline lists project events", () => {
    let state = baseState();
    const created = createProjectPure(state, {
      name: "T",
      ownerUserId: "u1",
    });
    state = created.state;
    state = setProjectStatusPure(state, "u1", created.project!.id, "planning")
      .state;
    const events = listProjectTimelinePure(state, created.project!.id);
    assert.ok(events.length >= 2);
  });

  test("documents searchable by ocr and title", () => {
    let state = baseState();
    const created = createProjectPure(state, {
      name: "Docs",
      ownerUserId: "u1",
    });
    state = created.state;
    const doc = addProjectDocumentPure(state, {
      userId: "u1",
      projectId: created.project!.id,
      kind: "pdf",
      title: "Contrato",
      fileName: "contrato.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      ocrText: "cláusula confidencialidade",
    });
    assert.equal(doc.error, null);
    state = doc.state;
    assert.equal(listProjectDocumentsPure(state, created.project!.id).length, 1);
    const hits = searchProjectDocumentsPure(state, "confidencialidade", {
      projectId: created.project!.id,
    });
    assert.equal(hits.length, 1);
  });
});

describe("RC4 Discovery filter", () => {
  test("filters related discoveries by project and types", () => {
    const arts = [
      {
        id: "d1",
        type: "OPPORTUNITY",
        status: "GENERATED",
        title: "Opp",
        relatedEntities: [{ entityType: "project", entityId: "prj_x" }],
        executionInfluence: "none",
      },
      {
        id: "d2",
        type: "RISK",
        status: "GENERATED",
        title: "Risk",
        relatedEntities: [{ entityType: "project", entityId: "other" }],
        executionInfluence: "none",
      },
      {
        id: "d3",
        type: "GAP",
        status: "GENERATED",
        title: "Gap mem",
        relatedEntities: [{ entityType: "memory", entityId: "m1" }],
        executionInfluence: "none",
      },
    ] as unknown as DiscoveryArtifact[];

    const filtered = filterDiscoveriesForProject(arts, "prj_x", {
      memoryIds: ["m1"],
    });
    assert.equal(filtered.length, 2);
    const grouped = groupDiscoveriesByType(filtered);
    assert.equal(grouped.OPPORTUNITY?.length, 1);
    assert.equal(grouped.GAP?.length, 1);
    assert.ok(filtered.every((a) => a.executionInfluence === "none"));
  });
});

describe("RC4 Business Hub", () => {
  test("create business and link project", () => {
    let state = baseState();
    const biz = createBusinessPure(state, {
      name: "Aura Labs",
      segment: "saas",
      ownerUserId: "u1",
    });
    assert.equal(biz.error, null);
    state = biz.state;
    const prj = createProjectPure(state, {
      name: "Core Product",
      ownerUserId: "u1",
      businessId: biz.business!.id,
    });
    assert.equal(prj.error, null);
    state = prj.state;
    const listed = listBusinessesPure(state, "u1");
    assert.equal(listed[0].projectIds.includes(prj.project!.id), true);
    assert.equal(searchBusinessesPure(state, "u1", "labs").length, 1);
  });
});

describe("RC4 store key & pagination", () => {
  test("workspace key isolation", () => {
    const k1 = projectsStoreKey("u1", null);
    const k2 = projectsStoreKey("u1", "ws1");
    assert.notEqual(k1, k2);
    setProjectsState(k1, createEmptyProjectsState());
    assert.equal(getProjectsState(k1).projects.length, 0);
  });

  test("list projects respects limit offset", () => {
    let state = baseState();
    for (let i = 0; i < 5; i++) {
      const r = createProjectPure(state, {
        name: `P${i}`,
        ownerUserId: "u1",
      });
      state = r.state;
    }
    const page = listProjectsPure(state, "u1", { limit: 2, offset: 1 });
    assert.equal(page.length, 2);
  });
});
