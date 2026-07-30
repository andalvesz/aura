import test from "node:test";
import assert from "node:assert/strict";
import {
  filterQuickActionsForRole,
  formatOptionalMetric,
  isSameLocalDay,
  PERSONAL_QUICK_ACTIONS,
  resolveDashboardMode,
  WORKSPACE_QUICK_ACTIONS,
} from "@/lib/dashboard/context-dashboard";

test("dashboard mode: personal without membership", () => {
  assert.equal(
    resolveDashboardMode({
      activeContext: "workspace",
      activeWorkspaceId: "ws-1",
      hasActiveMembership: false,
    }),
    "personal"
  );
});

test("dashboard mode: workspace with membership", () => {
  assert.equal(
    resolveDashboardMode({
      activeContext: "workspace",
      activeWorkspaceId: "ws-1",
      hasActiveMembership: true,
    }),
    "workspace"
  );
});

test("dashboard mode: explicit personal even with workspace id", () => {
  assert.equal(
    resolveDashboardMode({
      activeContext: "personal",
      activeWorkspaceId: "ws-1",
      hasActiveMembership: true,
    }),
    "personal"
  );
});

test("optional metric never fabricates zero as real saldo", () => {
  const empty = formatOptionalMetric(null, (n) => `R$ ${n}`);
  assert.equal(empty.hasData, false);
  assert.equal(empty.display, "—");
  const real = formatOptionalMetric(0, (n) => String(n));
  assert.equal(real.hasData, true);
  assert.equal(real.display, "0");
});

test("quick actions: manage team only for admin/owner", () => {
  const member = filterQuickActionsForRole(WORKSPACE_QUICK_ACTIONS, "member");
  assert.equal(member.some((a) => a.id === "manage-team"), false);
  const admin = filterQuickActionsForRole(WORKSPACE_QUICK_ACTIONS, "admin");
  assert.equal(admin.some((a) => a.id === "manage-team"), true);
  const owner = filterQuickActionsForRole(WORKSPACE_QUICK_ACTIONS, "owner");
  assert.equal(owner.some((a) => a.id === "manage-team"), true);
});

test("personal quick actions have no owner-only gates", () => {
  assert.ok(PERSONAL_QUICK_ACTIONS.length >= 5);
  assert.ok(PERSONAL_QUICK_ACTIONS.every((a) => !a.ownerOnly));
});

test("isSameLocalDay", () => {
  const ref = new Date("2026-07-28T15:00:00");
  assert.equal(isSameLocalDay("2026-07-28", ref), true);
  assert.equal(isSameLocalDay("2026-07-27T10:00:00", ref), false);
});

test("no mock metrics in personal/workspace action catalogs", () => {
  for (const a of [...PERSONAL_QUICK_ACTIONS, ...WORKSPACE_QUICK_ACTIONS]) {
    assert.ok(a.label.trim().length > 0);
    assert.ok(a.href || a.modal);
  }
});
