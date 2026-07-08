/** Aura Intelligence Factory v2 — text chunking for memory-safe extraction */

/** ~3k tokens; keeps OpenAI / heuristic extract payloads bounded per Function invocation */
export const AIF_MAX_CHUNK_CHARS = 12_000;

/** Hard ceiling: never send more than this to a single extract call */
export const AIF_HARD_MAX_EXTRACT_CHARS = 16_000;

export function createChunkId(fileId: string, index: number): string {
  const safe = String(fileId || "file")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64);
  return `${safe || "file"}-chunk-${index}`;
}

/**
 * Splits text into overlapping-safe chunks by paragraph/sentence boundaries.
 * Deterministic for the same input + maxChars (resume-safe).
 */
export function splitTextIntoChunks(
  text: string,
  maxTokensOrChars: number = AIF_MAX_CHUNK_CHARS
): string[] {
  const maxChars = Math.max(500, Math.min(maxTokensOrChars, AIF_HARD_MAX_EXTRACT_CHARS));
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    const piece = current.trim();
    if (piece) chunks.push(piece);
    current = "";
  };

  const pushOversized = (block: string) => {
    let rest = block;
    while (rest.length > maxChars) {
      let cut = rest.lastIndexOf(" ", maxChars);
      if (cut < maxChars * 0.5) cut = maxChars;
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) {
      if (current && current.length + rest.length + 2 > maxChars) flush();
      current = current ? `${current}\n\n${rest}` : rest;
    }
  };

  for (const paragraph of paragraphs) {
    const block = paragraph.trim();
    if (!block) continue;

    if (block.length > maxChars) {
      if (current) flush();
      pushOversized(block);
      continue;
    }

    const nextLen = current ? current.length + 2 + block.length : block.length;
    if (nextLen > maxChars) {
      flush();
      current = block;
    } else {
      current = current ? `${current}\n\n${block}` : block;
    }
  }

  flush();
  return chunks.length ? chunks : [normalized.slice(0, maxChars)];
}

export function logAifChunkPlan(params: {
  contentLength: number;
  chunkCount: number;
  maxChars?: number;
  fileId?: string;
}) {
  console.info("[aif-v2] chunk plan", {
    contentLength: params.contentLength,
    chunkCount: params.chunkCount,
    maxChars: params.maxChars ?? AIF_MAX_CHUNK_CHARS,
    fileId: params.fileId ?? null,
    memorySafe: true,
  });
}
