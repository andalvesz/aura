import test from "node:test";
import assert from "node:assert/strict";
import {
  ALVESZ_PDF_BUCKET,
  ALVESZ_PDF_SIGNED_URL_TTL_SECONDS,
  assertAlveszPdfPathAllowed,
  buildAlveszPdfStoragePath,
  classifyLegacyAlveszPdfPath,
  isCanonicalAlveszPdfPath,
  parseAlveszPdfStoragePath,
} from "@/lib/workspace/alvesz-pdf-storage";
import {
  canReadCommunicationLog,
  validateCommunicationLogRefs,
} from "@/lib/workspace/communication-log-refs";
import { classifyTable, UNRESOLVED_TABLES } from "@/lib/workspace/table-classification";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const WS_A = "11111111-1111-4111-8111-111111111111";
const WS_B = "22222222-2222-4222-8222-222222222222";
const PROP_A = "33333333-3333-4333-8333-333333333333";
const PROP_B = "44444444-4444-4444-8444-444444444444";
const USER_A = "55555555-5555-4555-8555-555555555555";
const USER_B = "66666666-6666-4666-8666-666666666666";
const CLIENT_B = "77777777-7777-4777-8777-777777777777";

test("alvesz pdf canonical path structure", () => {
  const path = buildAlveszPdfStoragePath({
    workspaceId: WS_A,
    proposalId: PROP_A,
    version: 2,
  });
  assert.equal(path, `workspaces/${WS_A}/propostas/${PROP_A}/proposta-v2.pdf`);
  assert.equal(isCanonicalAlveszPdfPath(path), true);
  assert.deepEqual(parseAlveszPdfStoragePath(path), {
    workspaceId: WS_A,
    proposalId: PROP_A,
    filename: "proposta-v2.pdf",
  });
});

test("alvesz pdf path rejects traversal and cross-workspace", () => {
  assert.throws(() =>
    buildAlveszPdfStoragePath({
      workspaceId: WS_A,
      proposalId: PROP_A,
      filename: "../escape.pdf",
    })
  );

  const pathB = buildAlveszPdfStoragePath({
    workspaceId: WS_B,
    proposalId: PROP_B,
    version: 1,
  });
  const denied = assertAlveszPdfPathAllowed({
    storagePath: pathB,
    workspaceId: WS_A,
    proposalId: PROP_A,
  });
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.reason, "workspace_mismatch");
});

test("alvesz pdf signed url TTL is short", () => {
  assert.ok(ALVESZ_PDF_SIGNED_URL_TTL_SECONDS <= 600);
  assert.ok(ALVESZ_PDF_SIGNED_URL_TTL_SECONDS > 0);
  assert.equal(ALVESZ_PDF_BUCKET, "alvesz-pdfs");
});

test("legacy path classification for audit (no move)", () => {
  const legacy = classifyLegacyAlveszPdfPath(`${WS_A}/${PROP_A}/proposta-v1.pdf`);
  assert.equal(legacy.kind, "legacy_workspace_prefix");
  assert.equal(legacy.prefix, WS_A);
  assert.equal(isCanonicalAlveszPdfPath(`${USER_A}/file.pdf`), false);
});

test("member of workspace A cannot use path of workspace B", () => {
  const path = buildAlveszPdfStoragePath({
    workspaceId: WS_B,
    proposalId: PROP_B,
  });
  const result = assertAlveszPdfPathAllowed({
    storagePath: path,
    workspaceId: WS_A,
    proposalId: PROP_B,
  });
  assert.equal(result.ok, false);
});

test("upload path manipulation blocked by canonical assert", () => {
  const forged = `workspaces/${WS_B}/propostas/${PROP_A}/proposta-v1.pdf`;
  const result = assertAlveszPdfPathAllowed({
    storagePath: forged,
    workspaceId: WS_A,
    proposalId: PROP_A,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "workspace_mismatch");
});

test("communication_log pointing to other workspace client is denied", () => {
  const result = validateCommunicationLogRefs({
    actorUserId: USER_A,
    isActiveMemberOf: (ws) => ws === WS_A,
    cliente: { table: "clientes", id: CLIENT_B, workspaceId: WS_B },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.violations.includes("cliente_inaccessible"));
  }
});

test("communication_log of another user cannot be read", () => {
  assert.equal(
    canReadCommunicationLog({ actorUserId: USER_A, rowUserId: USER_B }),
    false
  );
  assert.equal(
    canReadCommunicationLog({ actorUserId: USER_A, rowUserId: USER_A }),
    true
  );
});

test("communication_log allows own workspace cliente", () => {
  const result = validateCommunicationLogRefs({
    actorUserId: USER_A,
    isActiveMemberOf: (ws) => ws === WS_A,
    cliente: { table: "clientes", id: CLIENT_B, workspaceId: WS_A },
  });
  assert.equal(result.ok, true);
});

test("UNRESOLVED tables remain unresolved (no auto scope change)", () => {
  for (const t of UNRESOLVED_TABLES) {
    assert.equal(classifyTable(t), "UNRESOLVED");
  }
});

test("storage migration removes public select and creates member policies", () => {
  const path = resolve(
    process.cwd(),
    "supabase/migrations/20260728140000_alvesz_pdfs_private_storage_v1.sql"
  );
  assert.equal(existsSync(path), true);
  const sql = readFileSync(path, "utf8");
  assert.ok(sql.includes("public = false"));
  assert.ok(sql.includes('drop policy if exists "alvesz_pdfs_select_public"'));
  assert.ok(sql.includes("alvesz_pdfs_select_member"));
  assert.ok(sql.includes("alvesz_pdfs_insert_member"));
  assert.ok(sql.includes("is_workspace_member"));
  assert.ok(!sql.includes("delete from storage.objects"));
});

test("PDF POST route uses signed URLs and rejects client storage_path", () => {
  const path = resolve(process.cwd(), "app/api/alvesz-proposta-pdf/route.ts");
  const raw = readFileSync(path, "utf8");
  assert.ok(raw.includes("createSignedUrl"));
  assert.ok(!raw.includes("getPublicUrl"));
  assert.ok(raw.includes("storage_path não pode ser escolhido"));
  assert.ok(raw.includes("buildAlveszPdfStoragePath"));
  assert.ok(raw.includes("requireWorkspaceContext"));
});

test("PDF GET validates path and supports signed query", () => {
  const path = resolve(process.cwd(), "app/api/alvesz-proposta-pdf/[id]/route.ts");
  const raw = readFileSync(path, "utf8");
  assert.ok(raw.includes("assertAlveszPdfPathAllowed"));
  assert.ok(raw.includes('signed") === "1"'));
  assert.ok(raw.includes("createSignedUrl"));
  assert.ok(raw.includes("export async function DELETE"));
});

test("no service role in client supabase modules", () => {
  for (const rel of ["lib/supabase/client.ts", "lib/supabase/browser.ts"]) {
    const p = resolve(process.cwd(), rel);
    if (!existsSync(p)) continue;
    const raw = readFileSync(p, "utf8");
    assert.ok(!/SERVICE_ROLE|service_role/i.test(raw), rel);
  }
});

test("communication_logs migration adds workspace ref trigger", () => {
  const path = resolve(
    process.cwd(),
    "supabase/migrations/20260728150000_communication_logs_workspace_refs_v1.sql"
  );
  assert.equal(existsSync(path), true);
  const sql = readFileSync(path, "utf8");
  assert.ok(sql.includes("validate_communication_log_workspace_refs"));
  assert.ok(sql.includes("communication_log_invalid_cliente_ref"));
  assert.ok(!sql.includes("delete from public.communication_logs"));
});
