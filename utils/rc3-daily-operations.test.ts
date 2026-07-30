/**
 * RC3 Daily Operations — unit tests.
 */

import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import {
  addCommentPure,
  buildFeedPure,
  editCommentPure,
  filterTimelineByPeriod,
  listActivitiesPure,
  listCommentsPure,
  listFavoritesPure,
  listInboxPure,
  listNotificationsPure,
  markNotificationReadPure,
  pushNotificationPure,
  recordActivityPure,
  toggleFavoritePure,
  updateInboxStatusPure,
  upsertInboxItemPure,
} from "@/lib/daily/engine";
import { runQuickCaptureCascade } from "@/lib/daily/cascade";
import { createEmptyDailyOpsState } from "@/lib/daily/types";
import { clearDailyOpsState } from "@/lib/daily/store";
import { canViewerAccess } from "@/lib/aura-brain/visibility";

beforeEach(() => {
  clearDailyOpsState();
});

describe("RC3 Quick Capture cascade", () => {
  test("runs Memory→Promotion→World→Cognitive→Discovery with executionInfluence none", async () => {
    const report = await runQuickCaptureCascade("mem_1", {
      promoteMemory: async () => ({ error: null }),
      projectMemoryToWorld: async () => ({ error: null }),
      generateCognitive: async () => ({ error: null }),
      generateDiscoveries: async () => ({ error: null, generated: 2 }),
    });
    assert.equal(report.memoryId, "mem_1");
    assert.equal(report.promotionOk, true);
    assert.equal(report.worldOk, true);
    assert.equal(report.cognitiveOk, true);
    assert.equal(report.discoveryOk, true);
    assert.equal(report.discoveryGenerated, 2);
    assert.equal(report.executionInfluence, "none");
    assert.equal(report.errors.length, 0);
  });

  test("collects partial failures without throwing", async () => {
    const report = await runQuickCaptureCascade("mem_2", {
      promoteMemory: async () => ({ error: "blocked" }),
      projectMemoryToWorld: async () => ({ error: null }),
      generateCognitive: async () => {
        throw new Error("timeout");
      },
      generateDiscoveries: async () => ({ error: null, generated: 0 }),
    });
    assert.equal(report.promotionOk, false);
    assert.equal(report.cognitiveOk, false);
    assert.ok(report.errors.some((e) => e.includes("promotion")));
    assert.ok(report.errors.some((e) => e.includes("cognitive")));
    assert.equal(report.executionInfluence, "none");
  });
});

describe("RC3 Inbox", () => {
  test("lists unclassified and classifies", () => {
    let state = createEmptyDailyOpsState();
    state = upsertInboxItemPure(state, {
      memoryId: "m1",
      userId: "u1",
      workspaceId: null,
      title: "Nota",
      summary: "texto",
      tags: [],
      status: "unclassified",
      visibilityScope: "PRIVATE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    assert.equal(listInboxPure(state, "u1", "unclassified").length, 1);
    const res = updateInboxStatusPure(state, "u1", "m1", "classified", [
      "tag1",
    ]);
    assert.equal(res.error, null);
    assert.equal(res.item?.status, "classified");
    assert.deepEqual(res.item?.tags, ["tag1"]);
  });
});

describe("RC3 Favorites", () => {
  test("toggle add and remove", () => {
    let state = createEmptyDailyOpsState();
    const add = toggleFavoritePure(state, {
      userId: "u1",
      targetType: "discovery",
      targetId: "d1",
      title: "Risco",
      href: "/dashboard/discovery?id=d1",
    });
    state = add.state;
    assert.equal(listFavoritesPure(state, "u1").length, 1);
    const rem = toggleFavoritePure(state, {
      userId: "u1",
      targetType: "discovery",
      targetId: "d1",
      title: "Risco",
      href: "/dashboard/discovery?id=d1",
    });
    assert.equal(rem.removed, true);
    assert.equal(listFavoritesPure(rem.state, "u1").length, 0);
  });
});

describe("RC3 Comments + RLS mirror", () => {
  test("owner edits; other user cannot", () => {
    let state = createEmptyDailyOpsState();
    const created = addCommentPure(state, {
      userId: "u1",
      workspaceId: "ws1",
      targetType: "memory",
      targetId: "m1",
      body: "olá",
      visibilityScope: "WORKSPACE",
    });
    state = created.state;
    const denied = editCommentPure(state, {
      userId: "u2",
      commentId: created.comment.id,
      body: "hack",
    });
    assert.ok(denied.error);
    const ok = editCommentPure(state, {
      userId: "u1",
      commentId: created.comment.id,
      body: "editado",
    });
    assert.equal(ok.error, null);
    assert.equal(ok.comment?.body, "editado");
    assert.ok(ok.state.commentHistory.length >= 1);
  });

  test("private comment not visible to other member", () => {
    let state = createEmptyDailyOpsState();
    const created = addCommentPure(state, {
      userId: "u1",
      targetType: "discovery",
      targetId: "d1",
      body: "privado",
      visibilityScope: "PRIVATE",
    });
    state = created.state;
    const forB = listCommentsPure(
      state,
      { userId: "u2", workspaceId: "ws1", isWorkspaceMember: true },
      "discovery",
      "d1"
    );
    assert.equal(forB.length, 0);
  });
});

describe("RC3 Feed / Activity / Notifications", () => {
  test("feed builds from activities with visibility", () => {
    let state = createEmptyDailyOpsState();
    const a = recordActivityPure(state, {
      userId: "u1",
      actorUserId: "u1",
      workspaceId: "ws1",
      activityType: "memory_created",
      title: "Memória X",
      visibilityScope: "WORKSPACE",
      href: "/dashboard/inbox",
    });
    state = a.state;
    const feed = buildFeedPure(state.activities, {
      userId: "u2",
      workspaceId: "ws1",
      isWorkspaceMember: true,
    });
    assert.ok(feed.some((f) => f.kind === "memory"));
    const denied = buildFeedPure(state.activities, {
      userId: "u3",
      workspaceId: "ws2",
      isWorkspaceMember: false,
    });
    assert.equal(denied.length, 0);
  });

  test("notifications mark read", () => {
    let state = createEmptyDailyOpsState();
    const n = pushNotificationPure(state, {
      userId: "u1",
      kind: "new_discovery",
      title: "Nova",
    });
    state = n.state;
    assert.equal(listNotificationsPure(state, "u1", true).length, 1);
    state = markNotificationReadPure(state, "u1", n.notification.id);
    assert.equal(listNotificationsPure(state, "u1", true).length, 0);
  });

  test("list activities respects PRIVATE", () => {
    let state = createEmptyDailyOpsState();
    state = recordActivityPure(state, {
      userId: "u1",
      actorUserId: "u1",
      activityType: "comment",
      title: "privado",
      visibilityScope: "PRIVATE",
    }).state;
    assert.equal(
      listActivitiesPure(state, { userId: "u2", isWorkspaceMember: true })
        .length,
      0
    );
    assert.equal(
      listActivitiesPure(state, { userId: "u1" }).length,
      1
    );
  });
});

describe("RC3 Timeline filters", () => {
  test("filters by period", () => {
    const now = new Date();
    const old = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
    const items = [
      { id: "a", createdAt: now.toISOString() },
      { id: "b", createdAt: old.toISOString() },
    ];
    assert.equal(filterTimelineByPeriod(items, "today").length, 1);
    assert.equal(filterTimelineByPeriod(items, "all").length, 2);
  });
});

describe("RC3 Workspace RLS mirrors", () => {
  test("non-member cannot access WORKSPACE activity", () => {
    assert.equal(
      canViewerAccess({
        viewerUserId: "b",
        ownerUserId: "a",
        visibilityScope: "WORKSPACE",
        workspaceId: "ws1",
        viewerWorkspaceId: "ws1",
        isWorkspaceMember: false,
      }),
      false
    );
  });
});
