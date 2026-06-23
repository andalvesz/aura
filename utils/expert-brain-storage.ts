import type { ExpertKnowledgeSourceType } from "@/types/database";

export const EXPERT_BRAIN_FILES_BUCKET = "expert-brain-files";
export const EXPERT_BRAIN_TRANSCRIPTS_BUCKET = "expert-brain-transcripts";

/** 2 GB — única fonte de verdade para limites de upload no app */
export const EXPERT_BRAIN_MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

export const EXPERT_BRAIN_UPLOAD_LIMIT_LABEL = "Limite: 2 GB";

export type ExpertBrainUploadMode = "zip" | "videos" | "pdfs" | "transcripts";

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"]);
const PDF_EXTENSIONS = new Set([".pdf"]);
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown"]);
const ZIP_EXTENSIONS = new Set([".zip"]);

const ALLOWED_EXTENSIONS_BY_MODE: Record<ExpertBrainUploadMode, Set<string>> = {
  zip: ZIP_EXTENSIONS,
  videos: VIDEO_EXTENSIONS,
  pdfs: PDF_EXTENSIONS,
  transcripts: TEXT_EXTENSIONS,
};

const MODE_TYPE_LABEL: Record<ExpertBrainUploadMode, string> = {
  zip: "ZIP",
  videos: "MP4/vídeo",
  pdfs: "PDF",
  transcripts: "TXT/MD",
};

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

export function buildExpertBrainTranscriptPath(userId: string, baseName: string): string {
  const safeName = sanitizeExpertBrainFileName(baseName).replace(/\.[^.]+$/, "") || "transcript";
  const stamp = crypto.randomUUID();
  return `${userId}/${stamp}/${safeName}.txt`;
}

export function isExpertBrainVideoFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return VIDEO_EXTENSIONS.has(lower.slice(lower.lastIndexOf(".")));
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
  if (bytes > EXPERT_BRAIN_MAX_FILE_SIZE) return "Arquivo excede o limite de 2 GB.";
  return null;
}

export function validateExpertBrainFileType(
  fileName: string,
  mode: ExpertBrainUploadMode
): string | null {
  const lower = fileName.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot < 0) return `Tipo de arquivo inválido. Use ${MODE_TYPE_LABEL[mode]}.`;

  const ext = lower.slice(dot);
  const allowed = ALLOWED_EXTENSIONS_BY_MODE[mode];
  if (!allowed.has(ext)) {
    return `Tipo de arquivo inválido para ${MODE_TYPE_LABEL[mode]}: ${ext || fileName}`;
  }
  return null;
}

export function isSupabaseStorageSizeLimitError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("exceeded the maximum allowed size") ||
    lower.includes("entitytoolarge") ||
    lower.includes("payload too large") ||
    lower.includes("file size limit") ||
    lower.includes("413")
  );
}

export function formatExpertBrainStorageUploadError(message: string, fileSize: number): string {
  if (!isSupabaseStorageSizeLimitError(message)) return message;

  const sizeMb = Math.round(fileSize / (1024 * 1024));
  return (
    `Supabase Storage recusou o arquivo (${sizeMb} MB): limite do bucket ou global do projeto está abaixo do tamanho enviado. ` +
    `O app aceita até 2 GB — confira Storage Settings → Global file size limit (deve ser ≥ 2 GB). Erro original: ${message}`
  );
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
