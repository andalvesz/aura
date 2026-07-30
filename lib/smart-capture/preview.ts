/**
 * Preview helpers for image / PDF / link / audio.
 */

import type {
  AttachmentKind,
  CaptureAttachmentInput,
  LinkPreview,
} from "@/lib/smart-capture/types";

export type CapturePreview =
  | { kind: "image"; url: string; fileName: string }
  | { kind: "pdf"; url: string; fileName: string; pageHint?: string }
  | {
      kind: "link";
      preview: LinkPreview;
    }
  | { kind: "audio"; url: string; fileName: string }
  | { kind: "file"; fileName: string; mimeType: string }
  | { kind: "none" };

export function buildAttachmentPreview(
  att: CaptureAttachmentInput
): CapturePreview {
  if (att.kind === "image" && (att.url || att.dataUrl)) {
    return {
      kind: "image",
      url: (att.url ?? att.dataUrl) as string,
      fileName: att.fileName,
    };
  }
  if (att.kind === "pdf" && (att.url || att.dataUrl)) {
    return {
      kind: "pdf",
      url: (att.url ?? att.dataUrl) as string,
      fileName: att.fileName,
    };
  }
  if ((att.kind === "link" || att.kind === "video_link") && att.linkPreview) {
    return { kind: "link", preview: att.linkPreview };
  }
  if (att.kind === "audio" && (att.url || att.dataUrl)) {
    return {
      kind: "audio",
      url: (att.url ?? att.dataUrl) as string,
      fileName: att.fileName,
    };
  }
  return {
    kind: "file",
    fileName: att.fileName,
    mimeType: att.mimeType,
  };
}

export function previewKindLabel(kind: AttachmentKind): string {
  switch (kind) {
    case "image":
      return "Imagem";
    case "pdf":
      return "PDF";
    case "audio":
      return "Áudio";
    case "link":
      return "Link";
    case "video_link":
      return "Vídeo";
    default:
      return "Arquivo";
  }
}
