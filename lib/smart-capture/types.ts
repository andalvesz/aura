/**
 * RC3.1 Mobile & Smart Capture — contracts.
 * No Decision Support / Execution. Does not alter Cognitive Kernel.
 * executionInfluence remains "none".
 */

import type { VisibilityScope } from "@/lib/aura-brain/visibility";

export type CaptureMediaKind =
  | "text"
  | "image"
  | "pdf"
  | "audio"
  | "link"
  | "video_link"
  | "file";

export type AttachmentKind =
  | "image"
  | "pdf"
  | "audio"
  | "link"
  | "video_link"
  | "file";

export type UploadStatus =
  | "idle"
  | "queued"
  | "uploading"
  | "done"
  | "error"
  | "cancelled";

export type SyncItemStatus = "pending" | "syncing" | "sent" | "failed";

export type FavoritePinSurface = "home" | "search" | "feed";

export type CaptureAttachmentInput = {
  id?: string;
  kind: AttachmentKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Local object URL / remote URL after upload */
  url?: string;
  /** Storage path after upload */
  storagePath?: string;
  /** Base64 or data URL for offline queue (small files only) */
  dataUrl?: string;
  ocrText?: string;
  linkPreview?: LinkPreview;
};

export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  favicon: string | null;
  image: string | null;
  fetchedAt: string;
};

export type OcrResult = {
  text: string;
  confidence: number;
  provider: "pdf-parse" | "utf8" | "vision" | "manual" | "none";
  edited: boolean;
};

export type VirusScanResult = {
  status: "skipped" | "clean" | "suspicious" | "pending";
  provider: "none" | "prepared";
  scannedAt: string | null;
  detail: string | null;
};

export type SmartCaptureInput = {
  title?: string;
  description: string;
  ocrText?: string;
  attachments?: CaptureAttachmentInput[];
  links?: string[];
  tags?: string[];
  suggestedTags?: string[];
  acceptedSuggestedTags?: string[];
  visibility?: VisibilityScope;
  workspaceId?: string | null;
  shareWithWorkspace?: boolean;
  pinTo?: FavoritePinSurface[];
  source?: "quick_capture" | "share" | "drag_drop" | "offline_sync";
};

export type CascadeStepId =
  | "memory"
  | "promotion"
  | "world"
  | "cognitive"
  | "discovery";

export type CascadeStepStatus = "pending" | "running" | "done" | "error" | "skipped";

export type CascadeProgressStep = {
  id: CascadeStepId;
  label: string;
  status: CascadeStepStatus;
  error?: string;
};

export type OfflineCaptureItem = {
  id: string;
  userId: string;
  payload: SmartCaptureInput;
  status: SyncItemStatus;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
  attempts: number;
};

export type SyncPanelSnapshot = {
  pending: number;
  sent: number;
  failed: number;
  lastSyncAt: string | null;
  items: OfflineCaptureItem[];
};

export type MemoryAttachment = {
  id: string;
  userId: string;
  workspaceId: string | null;
  memoryId: string | null;
  kind: AttachmentKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string | null;
  url: string | null;
  ocrText: string | null;
  linkPreview: LinkPreview | null;
  tags: string[];
  virusScan: VirusScanResult;
  searchableText: string;
  createdAt: string;
  updatedAt: string;
};

export type UploadProgress = {
  id: string;
  fileName: string;
  percent: number;
  status: UploadStatus;
  startedAt: string | null;
  endedAt: string | null;
  estimatedSecondsLeft: number | null;
  error: string | null;
  bytesLoaded: number;
  bytesTotal: number;
};

export type FileValidationResult = {
  ok: boolean;
  error: string | null;
  kind: AttachmentKind | null;
};

export type SmartCaptureSearchHit = {
  attachmentId: string;
  memoryId: string | null;
  kind: AttachmentKind;
  fileName: string;
  snippet: string;
  matchField: "ocr" | "link" | "fileName" | "tags" | "searchable";
};

export const SMART_CAPTURE_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
export const SMART_CAPTURE_MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const SMART_CAPTURE_ALLOWED_MIME: Record<string, AttachmentKind> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "application/pdf": "pdf",
  "audio/mpeg": "audio",
  "audio/mp3": "audio",
  "audio/wav": "audio",
  "audio/webm": "audio",
  "audio/ogg": "audio",
  "audio/mp4": "audio",
  "text/plain": "file",
  "text/markdown": "file",
};

export const CASCADE_STEPS: CascadeProgressStep[] = [
  { id: "memory", label: "Memory", status: "pending" },
  { id: "promotion", label: "Promotion", status: "pending" },
  { id: "world", label: "World", status: "pending" },
  { id: "cognitive", label: "Cognitive", status: "pending" },
  { id: "discovery", label: "Discovery", status: "pending" },
];

export function newSmartCaptureId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function detectVideoLink(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("youtube.com") ||
    lower.includes("youtu.be") ||
    lower.includes("vimeo.com") ||
    lower.includes("tiktok.com") ||
    lower.includes("loom.com")
  );
}
