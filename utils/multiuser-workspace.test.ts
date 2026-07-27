import test from "node:test";
import assert from "node:assert/strict";
import {
  canDeleteWorkspace,
  canManageMembers,
  canMutateMember,
  isWorkspaceTable,
  normalizeInviteEmail,
} from "@/lib/workspace/constants";
import {
  generateInviteToken,
  hashInviteToken,
  buildInviteUrl,
} from "@/lib/workspace/invite-token";

test("workspace tables classification", () => {
  assert.equal(isWorkspaceTable("clientes"), true);
  assert.equal(isWorkspaceTable("gastos"), false);
  assert.equal(isWorkspaceTable("alvesz_propostas"), true);
});

test("role permissions: owner/admin manage members", () => {
  assert.equal(canManageMembers("owner"), true);
  assert.equal(canManageMembers("admin"), true);
  assert.equal(canManageMembers("member"), false);
  assert.equal(canDeleteWorkspace("owner"), true);
  assert.equal(canDeleteWorkspace("admin"), false);
});

test("admin cannot remove or demote owner", () => {
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
  const url = buildInviteUrl("https://aura.example", token);
  assert.match(url, /\/convite\//);
  assert.ok(!url.includes(hash));
});

test("normalize invite email", () => {
  assert.equal(normalizeInviteEmail("  Socio@Email.COM "), "socio@email.com");
});
