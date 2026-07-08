import test from "node:test";
import assert from "node:assert/strict";
import {
  extractSupabaseProjectRef,
  normalizeSupabaseUrl,
  previewSecret,
} from "@/lib/env";
import { isBadJwtError, jwtPreview } from "@/lib/supabase/auth-debug";

test("normalizeSupabaseUrl removes trailing slash", () => {
  assert.equal(normalizeSupabaseUrl("https://abc.supabase.co/"), "https://abc.supabase.co");
});

test("extractSupabaseProjectRef parses project ref", () => {
  assert.equal(extractSupabaseProjectRef("https://myproj.supabase.co"), "myproj");
});

test("previewSecret masks long values", () => {
  const preview = previewSecret("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", 20);
  assert.equal(preview.length, 21);
  assert.match(preview, /…$/);
});

test("jwtPreview returns first 20 chars", () => {
  assert.equal(jwtPreview("abcdefghijklmnopqrstuvwxyz"), "abcdefghijklmnopqrst");
});

test("isBadJwtError detects Supabase auth errors", () => {
  assert.equal(isBadJwtError({ code: "bad_jwt", message: "invalid JWT" }), true);
  assert.equal(
    isBadJwtError({ message: "invalid JWT: unable to parse or verify" }),
    true
  );
  assert.equal(isBadJwtError({ code: "other" }), false);
});
