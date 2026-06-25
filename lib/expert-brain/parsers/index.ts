import type { ExpertKnowledgeSourceType } from "@/types/database";

export type ParsedLessonFile = {
  path: string;
  fileName: string;
  title: string;
  sourceType: ExpertKnowledgeSourceType;
  text: string | null;
  buffer: Buffer | null;
  mimeType: string | null;
};

export type ParsedCourseStructure = {
  courseTitle: string;
  modules: Array<{
    title: string;
    lessons: ParsedLessonFile[];
  }>;
};

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown"]);
const PDF_EXTENSIONS = new Set([".pdf"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"]);

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? path;
}

function titleFromFileName(fileName: string): string {
  return basename(fileName).replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

function detectSourceType(fileName: string): ExpertKnowledgeSourceType {
  const lower = fileName.toLowerCase();
  if (TEXT_EXTENSIONS.has(lower.slice(lower.lastIndexOf(".")))) return "transcript";
  if (PDF_EXTENSIONS.has(lower.slice(lower.lastIndexOf(".")))) return "pdf";
  if (VIDEO_EXTENSIONS.has(lower.slice(lower.lastIndexOf(".")))) return "video";
  return "other";
}

function isLessonFile(path: string): boolean {
  const lower = path.toLowerCase();
  if (lower.includes("__macosx") || lower.startsWith(".")) return false;
  const ext = lower.slice(lower.lastIndexOf("."));
  return TEXT_EXTENSIONS.has(ext) || PDF_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext);
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse =
    typeof pdfParseModule === "function"
      ? pdfParseModule
      : (pdfParseModule as { default?: (buf: Buffer) => Promise<{ text?: string }> }).default;
  if (!pdfParse) return "";
  const result = await pdfParse(buffer);
  return result.text?.trim() ?? "";
}

export async function extractTextFromFile(
  fileName: string,
  buffer: Buffer
): Promise<{ text: string | null; sourceType: ExpertKnowledgeSourceType }> {
  const sourceType = detectSourceType(fileName);
  const lower = fileName.toLowerCase();

  if (TEXT_EXTENSIONS.has(lower.slice(lower.lastIndexOf(".")))) {
    return { text: buffer.toString("utf-8").trim(), sourceType };
  }

  if (PDF_EXTENSIONS.has(lower.slice(lower.lastIndexOf(".")))) {
    const text = await extractTextFromPdf(buffer);
    return { text: text || null, sourceType };
  }

  return { text: null, sourceType };
}

export async function transcribeVideoBuffer(
  buffer: Buffer,
  fileName: string
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const OpenAI = (await import("openai")).default;
  const { toFile } = await import("openai");
  const openai = new OpenAI({ apiKey });

  try {
    const file = await toFile(buffer, fileName);
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "pt",
    });
    return transcription.text?.trim() || null;
  } catch {
    return null;
  }
}

export async function parseZipCourse(buffer: Buffer, fallbackTitle?: string): Promise<ParsedCourseStructure> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.keys(zip.files).filter((path) => {
    const entry = zip.files[path];
    return entry && !entry.dir && isLessonFile(path);
  });

  if (entries.length === 0) {
    throw new Error("ZIP não contém arquivos de aula (.txt, .md, .pdf, .mp4).");
  }

  const moduleMap = new Map<string, Map<string, ParsedLessonFile[]>>();

  for (const path of entries) {
    const normalized = path.replace(/\\/g, "/");
    const parts = normalized.split("/").filter(Boolean);
    const fileName = basename(normalized);
    const entry = zip.files[path];
    if (!entry) continue;

    const fileBuffer = Buffer.from(await entry.async("arraybuffer"));
    const { text, sourceType } = await extractTextFromFile(fileName, fileBuffer);

    const lesson: ParsedLessonFile = {
      path: normalized,
      fileName,
      title: titleFromFileName(fileName),
      sourceType,
      text,
      buffer: sourceType === "video" ? fileBuffer : null,
      mimeType: null,
    };

    let courseKey = fallbackTitle?.trim() || "Curso importado";
    let moduleKey = "Módulo 1";

    if (parts.length >= 3) {
      courseKey = parts[0] ?? courseKey;
      moduleKey = parts[parts.length - 2] ?? moduleKey;
    } else if (parts.length === 2) {
      moduleKey = parts[0] ?? moduleKey;
    }

    if (!moduleMap.has(courseKey)) moduleMap.set(courseKey, new Map());
    const modules = moduleMap.get(courseKey)!;
    if (!modules.has(moduleKey)) modules.set(moduleKey, []);
    modules.get(moduleKey)!.push(lesson);
  }

  const firstCourse = [...moduleMap.keys()][0] ?? fallbackTitle ?? "Curso importado";
  const modulesForCourse = moduleMap.get(firstCourse) ?? new Map();

  return {
    courseTitle: firstCourse,
    modules: [...modulesForCourse.entries()].map(([title, lessons], index) => ({
      title: title.replace(/[-_]+/g, " ").trim() || `Módulo ${index + 1}`,
      lessons,
    })),
  };
}

export async function parseUploadedFiles(
  files: Array<{ name: string; buffer: Buffer }>,
  mode: "videos" | "pdfs" | "transcripts"
): Promise<ParsedCourseStructure> {
  const moduleTitle =
    mode === "videos" ? "Vídeos" : mode === "pdfs" ? "PDFs" : "Transcrições";

  const lessons: ParsedLessonFile[] = [];

  for (const file of files) {
    const { text, sourceType } = await extractTextFromFile(file.name, file.buffer);
    lessons.push({
      path: file.name,
      fileName: file.name,
      title: titleFromFileName(file.name),
      sourceType: mode === "transcripts" ? "transcript" : sourceType,
      text: mode === "transcripts" ? file.buffer.toString("utf-8").trim() : text,
      buffer: sourceType === "video" ? file.buffer : null,
      mimeType: null,
    });
  }

  return {
    courseTitle: `Upload ${moduleTitle}`,
    modules: [{ title: moduleTitle, lessons }],
  };
}
