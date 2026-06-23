import test from "node:test";
import assert from "node:assert/strict";
import {
  EXPERT_BRAIN_MAX_FILE_SIZE,
  EXPERT_BRAIN_UPLOAD_LIMIT_LABEL,
  formatExpertBrainStorageUploadError,
  isSupabaseStorageSizeLimitError,
  validateExpertBrainFileSize,
  validateExpertBrainFileType,
} from "./expert-brain-storage";

test("EXPERT_BRAIN_MAX_FILE_SIZE equals 2 GB", () => {
  assert.equal(EXPERT_BRAIN_MAX_FILE_SIZE, 2 * 1024 * 1024 * 1024);
  assert.equal(EXPERT_BRAIN_MAX_FILE_SIZE, 2147483648);
});

test("EXPERT_BRAIN_UPLOAD_LIMIT_LABEL", () => {
  assert.equal(EXPERT_BRAIN_UPLOAD_LIMIT_LABEL, "Limite: 2 GB");
});

test("validateExpertBrainFileSize accepts up to 2 GB", () => {
  assert.equal(validateExpertBrainFileSize(1), null);
  assert.equal(validateExpertBrainFileSize(164 * 1024 * 1024), null);
  assert.equal(validateExpertBrainFileSize(EXPERT_BRAIN_MAX_FILE_SIZE), null);
  assert.ok(validateExpertBrainFileSize(EXPERT_BRAIN_MAX_FILE_SIZE + 1)?.includes("2 GB"));
  assert.ok(validateExpertBrainFileSize(0)?.includes("vazio"));
});

test("validateExpertBrainFileType — ZIP", () => {
  assert.equal(validateExpertBrainFileType("curso.zip", "zip"), null);
  assert.ok(validateExpertBrainFileType("curso.mp4", "zip"));
});

test("validateExpertBrainFileType — PDF", () => {
  assert.equal(validateExpertBrainFileType("aula.pdf", "pdfs"), null);
  assert.ok(validateExpertBrainFileType("aula.zip", "pdfs"));
});

test("validateExpertBrainFileType — TXT/MD", () => {
  assert.equal(validateExpertBrainFileType("transcricao.txt", "transcripts"), null);
  assert.equal(validateExpertBrainFileType("notas.md", "transcripts"), null);
  assert.ok(validateExpertBrainFileType("aula.pdf", "transcripts"));
});

test("validateExpertBrainFileType — MP4/vídeo", () => {
  assert.equal(validateExpertBrainFileType("modulo-1.mp4", "videos"), null);
  assert.equal(validateExpertBrainFileType("aula.MP4", "videos"), null);
  assert.ok(validateExpertBrainFileType("aula.pdf", "videos"));
});

test("isSupabaseStorageSizeLimitError detects bucket/global limit errors", () => {
  assert.equal(
    isSupabaseStorageSizeLimitError("The object exceeded the maximum allowed size"),
    true
  );
  assert.equal(isSupabaseStorageSizeLimitError("Payload too large"), true);
  assert.equal(isSupabaseStorageSizeLimitError("permission denied"), false);
});

test("formatExpertBrainStorageUploadError annotates Supabase size errors", () => {
  const formatted = formatExpertBrainStorageUploadError(
    "The object exceeded the maximum allowed size",
    164 * 1024 * 1024
  );
  assert.ok(formatted.includes("Supabase Storage"));
  assert.ok(formatted.includes("Global file size limit"));
  assert.ok(formatted.includes("The object exceeded the maximum allowed size"));
});
