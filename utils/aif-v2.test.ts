import test from "node:test";
import assert from "node:assert/strict";
import {
  createChunkId,
  splitTextIntoChunks,
  AIF_MAX_CHUNK_CHARS,
  AIF_HARD_MAX_EXTRACT_CHARS,
} from "../lib/aif/chunking";
import {
  allChunksCompleted,
  aifChunkProgressPercent,
  getProgress,
  buildAifV2MetadataPatch,
  AIF_VERSION_V2,
  isAifChunkStatus,
} from "../lib/aif/aif-progress";
import { mergeChunkResults, emptyExtractionDraft } from "../lib/aif/aif-commit";
import type { ExpertIngestionQueueItem } from "../types/database";

function mockItem(
  overrides: Partial<ExpertIngestionQueueItem> & { metadata?: Record<string, unknown> }
): ExpertIngestionQueueItem {
  return {
    id: "ing-1",
    user_id: "user-1",
    file_path: "user-1/file.txt",
    course_name: null,
    module_name: null,
    lesson_name: null,
    file_name: "aula.txt",
    status: "extracting_chunk",
    progress: 60,
    error: null,
    retry_count: 0,
    last_error: null,
    current_step: null,
    current_chunk: 0,
    total_chunks: 0,
    processed_chunks: 0,
    last_attempt_at: null,
    next_retry_at: null,
    processing_by: null,
    processing_started_at: null,
    lease_until: null,
    updated_at: new Date().toISOString(),
    metadata: {},
    created_at: new Date().toISOString(),
    processed_at: null,
    ...overrides,
  };
}

test("splitTextIntoChunks splits large text under max chars", () => {
  const paragraph = "Framework de oferta.\n\n";
  const text = paragraph.repeat(800);
  assert.ok(text.length > AIF_MAX_CHUNK_CHARS);

  const chunks = splitTextIntoChunks(text, AIF_MAX_CHUNK_CHARS);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= AIF_HARD_MAX_EXTRACT_CHARS);
  }
  const reconstructed = chunks.join("\n\n").replace(/\s+/g, " ").trim();
  const original = text.replace(/\s+/g, " ").trim();
  assert.equal(reconstructed, original);
});

test("splitTextIntoChunks keeps small text as single chunk", () => {
  const chunks = splitTextIntoChunks("texto curto de aula");
  assert.deepEqual(chunks, ["texto curto de aula"]);
});

test("createChunkId is deterministic per file + index", () => {
  assert.equal(createChunkId("abc-123", 0), "abc-123-chunk-0");
  assert.equal(createChunkId("abc-123", 2), "abc-123-chunk-2");
});

test("getProgress resumes from metadata currentChunk / processedChunks", () => {
  const item = mockItem({
    metadata: {
      aifVersion: AIF_VERSION_V2,
      totalChunks: 5,
      currentChunk: 2,
      processedChunks: [0, 1],
      chunkPaths: ["a", "b", "c", "d", "e"],
      fileName: "aula.mp4",
    },
  });
  const progress = getProgress(item);
  assert.equal(progress.totalChunks, 5);
  assert.equal(progress.currentChunk, 2);
  assert.deepEqual(progress.processedChunks, [0, 1]);
  assert.equal(progress.aifVersion, AIF_VERSION_V2);
  assert.equal(allChunksCompleted(progress), false);
});

test("completed só quando todos chunks finalizarem", () => {
  assert.equal(
    allChunksCompleted({
      source: null,
      driveFileId: null,
      fileName: null,
      totalChunks: 3,
      currentChunk: 2,
      processedChunks: [0, 1],
      transcriptPath: null,
      chunkPaths: [],
      aifVersion: AIF_VERSION_V2,
      expertSourceId: null,
      pendingChunkDraft: null,
      lessonId: null,
      courseId: null,
      moduleId: null,
      author: null,
      niche: null,
    }),
    false
  );
  assert.equal(
    allChunksCompleted({
      source: null,
      driveFileId: null,
      fileName: null,
      totalChunks: 3,
      currentChunk: 2,
      processedChunks: [0, 1, 2],
      transcriptPath: null,
      chunkPaths: [],
      aifVersion: AIF_VERSION_V2,
      expertSourceId: "src-1",
      pendingChunkDraft: null,
      lessonId: null,
      courseId: null,
      moduleId: null,
      author: null,
      niche: null,
    }),
    true
  );
});

test("progress percent advances with processedChunks", () => {
  const early = aifChunkProgressPercent({
    totalChunks: 4,
    processedChunks: [],
    currentChunk: 0,
  });
  const late = aifChunkProgressPercent({
    totalChunks: 4,
    processedChunks: [0, 1, 2],
    currentChunk: 3,
  });
  assert.ok(late > early);
  assert.ok(late < 100);
});

test("buildAifV2MetadataPatch persists aifVersion v2", () => {
  const patch = buildAifV2MetadataPatch({
    totalChunks: 2,
    currentChunk: 0,
    processedChunks: [],
    chunkPaths: ["p0", "p1"],
  });
  assert.equal(patch.aifVersion, AIF_VERSION_V2);
  assert.equal(patch.totalChunks, 2);
  assert.deepEqual(patch.chunkPaths, ["p0", "p1"]);
});

test("mergeChunkResults deduplicates by name across chunks", () => {
  const a = emptyExtractionDraft();
  a.frameworks.push({
    id: "f1",
    type: "framework",
    name: "Offer Stack",
    category: "offer_creation",
    summary: "s1",
    principles: [],
    whenToUse: "",
    examples: [],
    confidence: { value: 70, reasons: [] },
  });
  const b = emptyExtractionDraft();
  b.frameworks.push({
    id: "f2",
    type: "framework",
    name: "Offer Stack",
    category: "offer_creation",
    summary: "s2",
    principles: [],
    whenToUse: "",
    examples: [],
    confidence: { value: 80, reasons: [] },
  });
  b.frameworks.push({
    id: "f3",
    type: "framework",
    name: "VSL Hook",
    category: "copywriting",
    summary: "s3",
    principles: [],
    whenToUse: "",
    examples: [],
    confidence: { value: 75, reasons: [] },
  });
  const merged = mergeChunkResults(a, b);
  assert.equal(merged.frameworks.length, 2);
});

test("isAifChunkStatus covers incremental statuses", () => {
  assert.equal(isAifChunkStatus("extracting_chunk"), true);
  assert.equal(isAifChunkStatus("committing_chunk"), true);
  assert.equal(isAifChunkStatus("extracting"), false);
  assert.equal(isAifChunkStatus("completed"), false);
});

test("queue limit clamp: memory-safe max is 3 (unit of policy)", () => {
  const clamp = (limit: number) => Math.max(1, Math.min(limit, 3));
  assert.equal(clamp(1), 1);
  assert.equal(clamp(0), 1);
  assert.equal(clamp(20), 3);
  assert.equal(clamp(5), 3);
});

test("não processa curso inteiro: chunks bound single extract size", () => {
  const courseText = "Aula completa. ".repeat(5000);
  const chunks = splitTextIntoChunks(courseText, AIF_MAX_CHUNK_CHARS);
  assert.ok(chunks.length > 1, "curso grande deve virar vários chunks");
  assert.ok(
    chunks.every((c) => c.length <= AIF_HARD_MAX_EXTRACT_CHARS),
    "nenhum chunk pode exceder hard max (evita OOM / OpenAI gigante)"
  );
});
