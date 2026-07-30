/**
 * File validation for Smart Capture — type, size, permissions shape.
 */

import {
  SMART_CAPTURE_ALLOWED_MIME,
  SMART_CAPTURE_MAX_BYTES,
  SMART_CAPTURE_MAX_IMAGE_BYTES,
  type AttachmentKind,
  type FileValidationResult,
} from "@/lib/smart-capture/types";

const EXT_TO_KIND: Record<string, AttachmentKind> = {
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".webp": "image",
  ".gif": "image",
  ".pdf": "pdf",
  ".mp3": "audio",
  ".wav": "audio",
  ".ogg": "audio",
  ".webm": "audio",
  ".m4a": "audio",
  ".txt": "file",
  ".md": "file",
};

export function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i >= 0 ? fileName.slice(i).toLowerCase() : "";
}

export function resolveAttachmentKind(
  mimeType: string,
  fileName: string
): AttachmentKind | null {
  const fromMime = SMART_CAPTURE_ALLOWED_MIME[mimeType.toLowerCase()];
  if (fromMime) return fromMime;
  return EXT_TO_KIND[extensionOf(fileName)] ?? null;
}

export function validateCaptureFile(input: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): FileValidationResult {
  const kind = resolveAttachmentKind(input.mimeType, input.fileName);
  if (!kind) {
    return {
      ok: false,
      error: `Tipo de arquivo não permitido: ${input.mimeType || extensionOf(input.fileName)}`,
      kind: null,
    };
  }
  const max =
    kind === "image" ? SMART_CAPTURE_MAX_IMAGE_BYTES : SMART_CAPTURE_MAX_BYTES;
  if (input.sizeBytes <= 0) {
    return { ok: false, error: "Arquivo vazio", kind };
  }
  if (input.sizeBytes > max) {
    return {
      ok: false,
      error: `Arquivo excede o limite de ${Math.round(max / (1024 * 1024))} MB`,
      kind,
    };
  }
  return { ok: true, error: null, kind };
}

export function assertWorkspacePermission(input: {
  shareWithWorkspace: boolean;
  workspaceId: string | null | undefined;
}): string | null {
  if (input.shareWithWorkspace && !input.workspaceId) {
    return "Workspace obrigatório para compartilhar";
  }
  return null;
}
