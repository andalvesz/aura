/**
 * Smart Capture service facade (RC3.1).
 * Wraps daily quickCapture + attachment library. executionInfluence: none.
 */

import {
  attachmentStoreKey,
  fromCaptureInputs,
  getAttachments,
  searchAttachmentsPure,
  setAttachments,
} from "@/lib/smart-capture/attachments";
import { mergeAcceptedTags, suggestTags } from "@/lib/smart-capture/tags";
import { assertWorkspacePermission } from "@/lib/smart-capture/validation";
import type {
  CaptureAttachmentInput,
  SmartCaptureInput,
  SmartCaptureSearchHit,
  MemoryAttachment,
} from "@/lib/smart-capture/types";
import { quickCapture, toggleFavorite } from "@/lib/supabase/services/daily-ops.service";
import { getDataContext } from "@/lib/supabase/services/context";
import type { CascadeReport, QuickCaptureInput } from "@/lib/daily/types";

function toQuickCaptureInput(input: SmartCaptureInput): QuickCaptureInput {
  const accepted = mergeAcceptedTags(
    input.tags ?? [],
    input.suggestedTags ?? [],
    input.acceptedSuggestedTags ?? input.suggestedTags ?? []
  );
  const rich = input.attachments ?? [];
  const legacyUrls = rich
    .map((a) => a.url)
    .filter((u): u is string => Boolean(u));

  const ocrParts = [
    input.ocrText?.trim(),
    ...rich.map((a) => a.ocrText?.trim()).filter(Boolean),
  ].filter(Boolean) as string[];

  const descriptionParts = [input.description.trim()];
  if (ocrParts.length) {
    descriptionParts.push(`\n\nOCR:\n${ocrParts.join("\n\n")}`);
  }

  return {
    title: input.title,
    description: descriptionParts.join(""),
    attachments: legacyUrls,
    richAttachments: rich.map((a) => ({
      kind: a.kind,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      url: a.url,
      storagePath: a.storagePath,
      ocrText: a.ocrText,
      linkPreview: a.linkPreview,
    })),
    links: input.links,
    tags: accepted,
    suggestedTags: input.suggestedTags,
    ocrText: input.ocrText,
    visibility: input.visibility,
    workspaceId: input.workspaceId,
    shareWithWorkspace: input.shareWithWorkspace,
    pinTo: input.pinTo,
    source: input.source ?? "quick_capture",
  };
}

export async function smartCapture(
  input: SmartCaptureInput
): Promise<{
  memoryId: string | null;
  cascade: CascadeReport | null;
  attachments: MemoryAttachment[];
  suggestedTags: string[];
  error: string | null;
}> {
  if (!input.description?.trim() && !input.ocrText?.trim() && !(input.attachments?.length)) {
    return {
      memoryId: null,
      cascade: null,
      attachments: [],
      suggestedTags: [],
      error: "Informe texto, OCR ou anexo",
    };
  }

  const wsCheck = assertWorkspacePermission({
    shareWithWorkspace: Boolean(input.shareWithWorkspace),
    workspaceId: input.workspaceId,
  });
  if (wsCheck) {
    return {
      memoryId: null,
      cascade: null,
      attachments: [],
      suggestedTags: [],
      error: wsCheck,
    };
  }

  const description =
    input.description?.trim() ||
    input.ocrText?.trim() ||
    input.attachments?.[0]?.fileName ||
    "Captura";

  const autoTags = suggestTags({
    title: input.title,
    description,
    ocrText: input.ocrText,
    links: input.links,
    fileNames: (input.attachments ?? []).map((a) => a.fileName),
    existingTags: input.tags,
  });

  const payload = toQuickCaptureInput({
    ...input,
    description,
    suggestedTags: input.suggestedTags?.length ? input.suggestedTags : autoTags,
    acceptedSuggestedTags: input.acceptedSuggestedTags ?? [],
  });

  const result = await quickCapture(payload);
  if (result.error || !result.memoryId) {
    return {
      memoryId: null,
      cascade: null,
      attachments: [],
      suggestedTags: autoTags,
      error: result.error ?? "Falha na captura",
    };
  }

  const ctx = await getDataContext();
  const ws =
    input.workspaceId !== undefined
      ? input.workspaceId
      : ctx.activeWorkspaceId ?? null;
  const key = attachmentStoreKey(ctx.userId, ws);
  const created = fromCaptureInputs(
    ctx.userId,
    ws,
    result.memoryId,
    (input.attachments ?? []) as CaptureAttachmentInput[]
  );
  setAttachments(key, [...created, ...getAttachments(key)]);

  if (input.pinTo?.length) {
    await toggleFavorite({
      targetType: "memory",
      targetId: result.memoryId,
      title: payload.title?.trim() || description.slice(0, 80),
      href: `/dashboard/inbox?id=${result.memoryId}`,
      pins: input.pinTo,
    });
  }

  return {
    memoryId: result.memoryId,
    cascade: result.cascade,
    attachments: created,
    suggestedTags: autoTags,
    error: null,
  };
}

export async function listMemoryAttachments(): Promise<MemoryAttachment[]> {
  const ctx = await getDataContext();
  const key = attachmentStoreKey(ctx.userId, ctx.activeWorkspaceId ?? null);
  return getAttachments(key).filter((a) => a.userId === ctx.userId);
}

export async function searchMemoryAttachments(
  query: string
): Promise<SmartCaptureSearchHit[]> {
  const ctx = await getDataContext();
  const key = attachmentStoreKey(ctx.userId, ctx.activeWorkspaceId ?? null);
  return searchAttachmentsPure(getAttachments(key), ctx.userId, query, {
    workspaceId: ctx.activeWorkspaceId ?? null,
  });
}

export function suggestCaptureTags(input: {
  title?: string;
  description?: string;
  ocrText?: string;
  links?: string[];
  fileNames?: string[];
  existingTags?: string[];
}): string[] {
  return suggestTags(input);
}
