import {
  extractTextFromFile,
  parseZipCourse,
  transcribeVideoBuffer,
  type ParsedCourseStructure,
} from "@/lib/expert-brain/parsers";
import type { AifImportResult, AifImportSourceType, AifPipelineInput } from "@/utils/aif";

export type AifImportPipelineOptions = {
  youtubeTranscript?: string | null;
};

function detectSourceType(fileName: string, explicit?: string): AifImportSourceType | string {
  if (explicit) return explicit;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".webm")) return "mp4";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "txt";
  if (lower.endsWith(".zip")) return "zip";
  return "txt";
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = zip.file("word/document.xml");
  if (!documentXml) return "";

  const xml = await documentXml.async("string");
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractFromBuffer(
  fileName: string,
  buffer: Buffer,
  sourceType: AifImportSourceType | string
): Promise<{ text: string | null; error: string | null }> {
  const type = sourceType as AifImportSourceType;

  if (type === "zip") {
    try {
      const structure = await parseZipCourse(buffer, fileName.replace(/\.zip$/i, ""));
      const texts: string[] = [];
      for (const mod of structure.modules) {
        for (const lesson of mod.lessons) {
          if (lesson.text?.trim()) texts.push(lesson.text.trim());
        }
      }
      return { text: texts.join("\n\n") || null, error: texts.length ? null : "ZIP sem texto extraível." };
    } catch (err) {
      return { text: null, error: err instanceof Error ? err.message : "Erro ao processar ZIP." };
    }
  }

  if (type === "mp4") {
    const transcript = await transcribeVideoBuffer(buffer, fileName);
    return transcript
      ? { text: transcript, error: null }
      : { text: null, error: "Transcrição indisponível (OPENAI_API_KEY ou arquivo inválido)." };
  }

  if (type === "docx") {
    const text = await extractDocxText(buffer);
    return text ? { text, error: null } : { text: null, error: "DOCX sem texto extraível." };
  }

  const { text } = await extractTextFromFile(fileName, buffer);
  return text ? { text, error: null } : { text: null, error: "Arquivo sem texto extraível." };
}

export async function runAifImportPipeline(
  input: AifPipelineInput,
  options: AifImportPipelineOptions = {}
): Promise<AifImportResult> {
  const title = input.title?.trim() || input.fileName?.trim() || "Material importado";
  const sourceType = detectSourceType(input.fileName ?? title, input.sourceType);

  if (sourceType === "youtube") {
    const transcript = options.youtubeTranscript?.trim() || input.rawText?.trim();
    if (!transcript) {
      return {
        rawText: "",
        sourceType,
        title,
        wordCount: 0,
        error: "YouTube requer transcrição fornecida (youtubeTranscript ou rawText).",
      };
    }
    return {
      rawText: transcript,
      sourceType,
      title,
      wordCount: transcript.split(/\s+/).length,
      error: null,
    };
  }

  if (sourceType === "google_drive") {
    const text = input.rawText?.trim();
    if (!text) {
      return {
        rawText: "",
        sourceType,
        title,
        wordCount: 0,
        error: "Google Drive requer rawText pré-baixado pelo conector Drive.",
      };
    }
    return {
      rawText: text,
      sourceType,
      title,
      wordCount: text.split(/\s+/).length,
      error: null,
    };
  }

  if (input.rawText?.trim()) {
    const rawText = input.rawText.trim();
    return {
      rawText,
      sourceType,
      title,
      wordCount: rawText.split(/\s+/).length,
      error: null,
    };
  }

  if (!input.buffer || !input.fileName) {
    return {
      rawText: "",
      sourceType,
      title,
      wordCount: 0,
      error: "Informe rawText ou buffer + fileName.",
    };
  }

  const { text, error } = await extractFromBuffer(input.fileName, input.buffer, sourceType);
  if (error || !text?.trim()) {
    return { rawText: "", sourceType, title, wordCount: 0, error: error ?? "Texto vazio." };
  }

  return {
    rawText: text.trim(),
    sourceType,
    title,
    wordCount: text.trim().split(/\s+/).length,
    error: null,
  };
}

export function flattenParsedCourse(structure: ParsedCourseStructure): string {
  const chunks: string[] = [];
  for (const mod of structure.modules) {
    chunks.push(`# ${mod.title}`);
    for (const lesson of mod.lessons) {
      if (lesson.text?.trim()) {
        chunks.push(`## ${lesson.title}\n${lesson.text.trim()}`);
      }
    }
  }
  return chunks.join("\n\n");
}

export const AIF_SUPPORTED_EXTENSIONS = [".pdf", ".mp4", ".docx", ".txt", ".md", ".zip"] as const;
