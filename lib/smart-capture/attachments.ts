/**
 * Attachment library — in-memory store + pure engine (searchable).
 */

import { prepareVirusScan } from "@/lib/smart-capture/security";
import {
  newSmartCaptureId,
  type AttachmentKind,
  type CaptureAttachmentInput,
  type LinkPreview,
  type MemoryAttachment,
  type SmartCaptureSearchHit,
} from "@/lib/smart-capture/types";

const attachmentsByKey = new Map<string, MemoryAttachment[]>();

export function attachmentStoreKey(
  userId: string,
  workspaceId: string | null
): string {
  return `${userId}::${workspaceId ?? "personal"}`;
}

export function clearAttachmentStore(): void {
  attachmentsByKey.clear();
}

export function getAttachments(key: string): MemoryAttachment[] {
  return attachmentsByKey.get(key) ?? [];
}

export function setAttachments(key: string, rows: MemoryAttachment[]): void {
  attachmentsByKey.set(key, rows);
}

export function buildSearchableText(input: {
  fileName: string;
  ocrText?: string | null;
  linkPreview?: LinkPreview | null;
  tags?: string[];
}): string {
  return [
    input.fileName,
    input.ocrText ?? "",
    input.linkPreview?.title ?? "",
    input.linkPreview?.description ?? "",
    input.linkPreview?.url ?? "",
    ...(input.tags ?? []),
  ]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function createAttachmentPure(input: {
  userId: string;
  workspaceId?: string | null;
  memoryId?: string | null;
  kind: AttachmentKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath?: string | null;
  url?: string | null;
  ocrText?: string | null;
  linkPreview?: LinkPreview | null;
  tags?: string[];
}): MemoryAttachment {
  const now = new Date().toISOString();
  const tags = input.tags ?? [];
  return {
    id: newSmartCaptureId("att"),
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    memoryId: input.memoryId ?? null,
    kind: input.kind,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    storagePath: input.storagePath ?? null,
    url: input.url ?? null,
    ocrText: input.ocrText ?? null,
    linkPreview: input.linkPreview ?? null,
    tags,
    virusScan: prepareVirusScan(),
    searchableText: buildSearchableText({
      fileName: input.fileName,
      ocrText: input.ocrText,
      linkPreview: input.linkPreview,
      tags,
    }),
    createdAt: now,
    updatedAt: now,
  };
}

export function attachToMemoryPure(
  rows: MemoryAttachment[],
  attachmentId: string,
  memoryId: string,
  userId: string
): { rows: MemoryAttachment[]; error: string | null } {
  const idx = rows.findIndex((r) => r.id === attachmentId);
  if (idx < 0) return { rows, error: "Anexo não encontrado" };
  if (rows[idx].userId !== userId) {
    return { rows, error: "Sem permissão" };
  }
  const next = [...rows];
  next[idx] = {
    ...next[idx],
    memoryId,
    updatedAt: new Date().toISOString(),
  };
  return { rows: next, error: null };
}

export function searchAttachmentsPure(
  rows: MemoryAttachment[],
  userId: string,
  query: string,
  opts?: { workspaceId?: string | null; limit?: number }
): SmartCaptureSearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const limit = opts?.limit ?? 30;
  const hits: SmartCaptureSearchHit[] = [];

  for (const row of rows) {
    if (row.userId !== userId) continue;
    if (
      opts?.workspaceId !== undefined &&
      opts.workspaceId !== null &&
      row.workspaceId !== opts.workspaceId &&
      row.workspaceId !== null
    ) {
      // personal attachments always visible to owner
    }

    let matchField: SmartCaptureSearchHit["matchField"] | null = null;
    let snippet = "";

    if (row.ocrText?.toLowerCase().includes(q)) {
      matchField = "ocr";
      const i = row.ocrText.toLowerCase().indexOf(q);
      snippet = row.ocrText.slice(Math.max(0, i - 40), i + q.length + 60);
    } else if (row.linkPreview?.url?.toLowerCase().includes(q)) {
      matchField = "link";
      snippet = row.linkPreview.url;
    } else if (row.linkPreview?.title?.toLowerCase().includes(q)) {
      matchField = "link";
      snippet = row.linkPreview.title;
    } else if (row.fileName.toLowerCase().includes(q)) {
      matchField = "fileName";
      snippet = row.fileName;
    } else if (row.tags.some((t) => t.toLowerCase().includes(q))) {
      matchField = "tags";
      snippet = row.tags.join(", ");
    } else if (row.searchableText.includes(q)) {
      matchField = "searchable";
      snippet = row.fileName;
    }

    if (matchField) {
      hits.push({
        attachmentId: row.id,
        memoryId: row.memoryId,
        kind: row.kind,
        fileName: row.fileName,
        snippet,
        matchField,
      });
      if (hits.length >= limit) break;
    }
  }

  return hits;
}

export function fromCaptureInputs(
  userId: string,
  workspaceId: string | null,
  memoryId: string | null,
  inputs: CaptureAttachmentInput[]
): MemoryAttachment[] {
  return inputs.map((a) =>
    createAttachmentPure({
      userId,
      workspaceId,
      memoryId,
      kind: a.kind,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      storagePath: a.storagePath ?? null,
      url: a.url ?? null,
      ocrText: a.ocrText ?? null,
      linkPreview: a.linkPreview ?? null,
    })
  );
}
