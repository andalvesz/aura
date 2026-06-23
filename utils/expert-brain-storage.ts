import type { ExpertKnowledgeSourceType } from "@/types/database";

export const EXPERT_BRAIN_FILES_BUCKET = "expert-brain-files";

/** 2 GB */
export const EXPERT_BRAIN_MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"]);
const PDF_EXTENSIONS = new Set([".pdf"]);
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown"]);
const ZIP_EXTENSIONS = new Set([".zip"]);

export function sanitizeExpertBrainFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180);
}

export function buildExpertBrainStoragePath(userId: string, fileName: string): string {
  const safeName = sanitizeExpertBrainFileName(fileName);
  const stamp = crypto.randomUUID();
  return `${userId}/${stamp}/${safeName}`;
}

export function assertExpertBrainStoragePathOwned(userId: string, filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return normalized.startsWith(`${userId}/`);
}

export function detectExpertBrainSourceType(fileName: string): ExpertKnowledgeSourceType {
  const lower = fileName.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf("."));
  if (ZIP_EXTENSIONS.has(ext)) return "course";
  if (TEXT_EXTENSIONS.has(ext)) return "transcript";
  if (PDF_EXTENSIONS.has(ext)) return "pdf";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return "other";
}

export function isExpertBrainZipFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ZIP_EXTENSIONS.has(lower.slice(lower.lastIndexOf(".")));
}

export function titleFromExpertBrainFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  return base.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Aula";
}

export function validateExpertBrainFileSize(bytes: number): string | null {
  if (bytes <= 0) return "Arquivo vazio.";
  if (bytes > EXPERT_BRAIN_MAX_FILE_BYTES) return "Arquivo excede o limite de 2 GB.";
  return null;
}

export function guessExpertBrainContentType(fileName: string): string {
  const lower = fileName.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf("."));
  if (ZIP_EXTENSIONS.has(ext)) return "application/zip";
  if (PDF_EXTENSIONS.has(ext)) return "application/pdf";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".webm") return "video/webm";
  if (ext === ".md" || ext === ".markdown") return "text/markdown";
  if (ext === ".txt") return "text/plain";
  return "application/octet-stream";
}
