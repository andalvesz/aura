import test from "node:test";
import assert from "node:assert/strict";
import {
  canDeleteWorkspace,
  canManageMembers,
  canMutateMember,
  isWorkspaceTable,
  normalizeInviteEmail,
  WORKSPACE_TABLES,
} from "@/lib/workspace/constants";
import {
  generateInviteToken,
  hashInviteToken,
  buildInviteUrl,
} from "@/lib/workspace/invite-token";
import {
  PERSONAL_AUDIT_SAMPLE,
  SYSTEM_TABLES,
  UNRESOLVED_TABLES,
  canAccessPersonalRow,
  canAccessWorkspaceRow,
  classifyTable,
  evaluateInviteAccept,
  isExpertBrainPersonalTable,
  resolveEffectiveContext,
} from "@/lib/workspace/table-classification";

test("workspace tables classification", () => {
  assert.equal(isWorkspaceTable("clientes"), true);
  assert.equal(isWorkspaceTable("gastos"), false);
  assert.equal(isWorkspaceTable("alvesz_propostas"), true);
  assert.equal(WORKSPACE_TABLES.length, 6);
});

test("table scope map: workspace / system / unresolved / personal", () => {
  for (const t of WORKSPACE_TABLES) {
    assert.equal(classifyTable(t), "WORKSPACE");
  }
  for (const t of SYSTEM_TABLES) {
    assert.equal(classifyTable(t), "SYSTEM");
  }
  for (const t of UNRESOLVED_TABLES) {
    assert.equal(classifyTable(t), "UNRESOLVED");
  }
  assert.equal(classifyTable("gastos"), "PERSONAL");
  assert.equal(classifyTable("expert_ingestion_queue"), "PERSONAL");
  assert.equal(classifyTable("eventos"), "PERSONAL");
  assert.equal(classifyTable("alvesz_eventos"), "WORKSPACE");
});

test("expert brain remains personal — never workspace scoped", () => {
  assert.equal(isExpertBrainPersonalTable("expert_transcripts"), true);
  assert.equal(isExpertBrainPersonalTable("expert_ingestion_queue"), true);
  assert.equal(isExpertBrainPersonalTable("clientes"), false);
  for (const t of [
    "expert_frameworks",
    "expert_knowledge_sources",
    "expert_processing_queue",
  ]) {
    assert.equal(classifyTable(t), "PERSONAL");
  }
});

test("personal audit sample is never classified as WORKSPACE", () => {
  for (const t of PERSONAL_AUDIT_SAMPLE) {
    if (t === "profiles") {
      assert.equal(classifyTable(t), "SYSTEM");
      continue;
    }
    assert.notEqual(classifyTable(t), "WORKSPACE", t);
  }
});

test("isolation PERSONAL between two users", () => {
  assert.equal(
    canAccessPersonalRow({ actorUserId: "user-a", rowUserId: "user-a" }),
    true
  );
  assert.equal(
    canAccessPersonalRow({ actorUserId: "user-a", rowUserId: "user-b" }),
    false
  );
});

test("isolation between two Workspaces", () => {
  assert.equal(
    canAccessWorkspaceRow({
      actorWorkspaceId: "ws-a",
      rowWorkspaceId: "ws-a",
      isMember: true,
    }),
    true
  );
  assert.equal(
    canAccessWorkspaceRow({
      actorWorkspaceId: "ws-a",
      rowWorkspaceId: "ws-b",
      isMember: true,
    }),
    false
  );
  assert.equal(
    canAccessWorkspaceRow({
      actorWorkspaceId: "ws-a",
      rowWorkspaceId: "ws-a",
      isMember: false,
    }),
    false
  );
});

test("role permissions: owner/admin manage members", () => {
  assert.equal(canManageMembers("owner"), true);
  assert.equal(canManageMembers("admin"), true);
  assert.equal(canManageMembers("member"), false);
  assert.equal(canDeleteWorkspace("owner"), true);
  assert.equal(canDeleteWorkspace("admin"), false);
});

test("admin cannot remove or demote owner / assume ownership", () => {
  assert.equal(
    canMutateMember({
      actorRole: "admin",
      targetRole: "owner",
      targetUserId: "owner-id",
      actorUserId: "admin-id",
      action: "remove",
    }),
    false
  );
  assert.equal(
    canMutateMember({
      actorRole: "admin",
      targetRole: "member",
      targetUserId: "m1",
      actorUserId: "admin-id",
      action: "remove",
    }),
    true
  );
  assert.equal(
    canMutateMember({
      actorRole: "admin",
      targetRole: "member",
      targetUserId: "m1",
      actorUserId: "admin-id",
      action: "change_role",
      nextRole: "admin",
    }),
    false
  );
  assert.equal(
    canMutateMember({
      actorRole: "admin",
      targetRole: "member",
      targetUserId: "m1",
      actorUserId: "admin-id",
      action: "change_role",
      nextRole: "owner",
    }),
    false
  );
  assert.equal(
    canMutateMember({
      actorRole: "owner",
      targetRole: "admin",
      targetUserId: "a1",
      actorUserId: "owner-id",
      action: "change_role",
      nextRole: "member",
    }),
    true
  );
});

test("context switch: invalid membership falls back to personal", () => {
  assert.deepEqual(
    resolveEffectiveContext({
      activeContext: "workspace",
      activeWorkspaceId: "ws-1",
      hasActiveMembership: false,
    }),
    { activeContext: "personal", activeWorkspaceId: null }
  );
});

test("context switch: valid membership keeps workspace", () => {
  assert.deepEqual(
    resolveEffectiveContext({
      activeContext: "workspace",
      activeWorkspaceId: "ws-1",
      hasActiveMembership: true,
    }),
    { activeContext: "workspace", activeWorkspaceId: "ws-1" }
  );
});

test("user without workspace stays personal", () => {
  assert.deepEqual(
    resolveEffectiveContext({
      activeContext: "workspace",
      activeWorkspaceId: null,
      hasActiveMembership: false,
    }),
    { activeContext: "personal", activeWorkspaceId: null }
  );
});

test("active_workspace_id invalid without membership", () => {
  const resolved = resolveEffectiveContext({
    activeContext: "workspace",
    activeWorkspaceId: "ghost-ws",
    hasActiveMembership: false,
  });
  assert.equal(resolved.activeContext, "personal");
  assert.equal(resolved.activeWorkspaceId, null);
});

test("invite token is hashed; raw token never equals hash", () => {
  const token = generateInviteToken();
  const hash = hashInviteToken(token);
  assert.notEqual(token, hash);
  assert.equal(hash.length, 64);
  assert.equal(hashInviteToken(token), hash);
  assert.notEqual(hashInviteToken(token + "x"), hash);
});

test("invite URL does not embed hash", () => {
  const token = generateInviteToken();
  const hash = hashInviteToken(token);
  const url = buildInviteUrl("https://aura-ten-rose.vercel.app", token);
  assert.match(url, /^https:\/\/aura-ten-rose\.vercel\.app\/convite\//);
  assert.ok(!url.includes(hash));
});

test("invite valid", () => {
  assert.equal(
    evaluateInviteAccept({
      inviteFound: true,
      acceptedAt: null,
      expiresAt: "2099-01-01T00:00:00.000Z",
      inviteEmail: "socio@empresa.com",
      userEmail: "socio@empresa.com",
    }),
    "valid"
  );
});

test("invite expired", () => {
  assert.equal(
    evaluateInviteAccept({
      inviteFound: true,
      acceptedAt: null,
      expiresAt: "2020-01-01T00:00:00.000Z",
      inviteEmail: "a@b.com",
      userEmail: "a@b.com",
      nowIso: "2026-07-28T00:00:00.000Z",
    }),
    "expired"
  );
});

test("invite reused", () => {
  assert.equal(
    evaluateInviteAccept({
      inviteFound: true,
      acceptedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2099-01-01T00:00:00.000Z",
      inviteEmail: "a@b.com",
      userEmail: "a@b.com",
    }),
    "already_used"
  );
});

test("invite email mismatch", () => {
  assert.equal(
    evaluateInviteAccept({
      inviteFound: true,
      acceptedAt: null,
      expiresAt: "2099-01-01T00:00:00.000Z",
      inviteEmail: "owner@empresa.com",
      userEmail: "outro@empresa.com",
    }),
    "email_mismatch"
  );
});

test("invite not found / absence of profile treated as not_found invite", () => {
  assert.equal(
    evaluateInviteAccept({
      inviteFound: false,
      acceptedAt: null,
      expiresAt: "2099-01-01T00:00:00.000Z",
      inviteEmail: "a@b.com",
      userEmail: "a@b.com",
    }),
    "not_found"
  );
});

test("normalize invite email", () => {
  assert.equal(normalizeInviteEmail("  Socio@Email.COM "), "socio@email.com");
});

test("IDOR: forged workspace_id in request denied without membership", () => {
  assert.equal(
    canAccessWorkspaceRow({
      actorWorkspaceId: "forged-ws-b",
      rowWorkspaceId: "ws-a",
      isMember: false,
    }),
    false
  );
});
