import type { Json } from "@/types/database";
import { transcribeVideoBuffer } from "@/lib/expert-brain/parsers";
import { ExpertTranscriptsRepository } from "@/lib/supabase/repositories/expert-brain.repository";
import {
  EXPERT_BRAIN_FILES_BUCKET,
  EXPERT_BRAIN_TRANSCRIPTS_BUCKET,
  buildExpertBrainTranscriptPath,
} from "@/utils/expert-brain-storage";
import { countWords, logExpertBrain } from "@/utils/expert-brain-pipeline";
import { getOptionalDataContext } from "./context";

export function hasOpenAiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

async function downloadExpertBrainFile(filePath: string): Promise<Buffer | null> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return null;

  const { data, error } = await ctx.supabase.storage
    .from(EXPERT_BRAIN_FILES_BUCKET)
    .download(filePath);

  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

async function uploadTranscriptText(
  userId: string,
  fileName: string,
  text: string
): Promise<{ path: string | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { path: null, error: "Usuário não autenticado." };

  const transcriptPath = buildExpertBrainTranscriptPath(userId, fileName);
  const { error } = await ctx.supabase.storage
    .from(EXPERT_BRAIN_TRANSCRIPTS_BUCKET)
    .upload(transcriptPath, text, {
      upsert: true,
      contentType: "text/plain",
    });

  if (error) return { path: null, error: error.message };
  return { path: transcriptPath, error: null };
}

export async function downloadExpertBrainTranscript(
  transcriptPath: string
): Promise<{ text: string | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { text: null, error: "Usuário não autenticado." };

  const { data, error } = await ctx.supabase.storage
    .from(EXPERT_BRAIN_TRANSCRIPTS_BUCKET)
    .download(transcriptPath);

  if (error || !data) return { text: null, error: error?.message ?? "Transcrição não encontrada." };
  return { text: await data.text(), error: null };
}

export type TranscribeIngestionVideoInput = {
  ingestionId: string;
  filePath: string;
  fileName: string;
  lessonId?: string | null;
};

export async function transcribeIngestionVideo(
  input: TranscribeIngestionVideoInput
): Promise<{
  transcriptId: string | null;
  rawText: string | null;
  waitingForOpenai: boolean;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { transcriptId: null, rawText: null, waitingForOpenai: false, error: "Usuário não autenticado." };
  }

  const transcriptsRepo = new ExpertTranscriptsRepository(ctx.supabase, ctx.userId);

  if (!hasOpenAiKey()) {
    const { data: existing } = await transcriptsRepo.findByIngestionId(input.ingestionId);
    if (existing) {
      await transcriptsRepo.updateStatus(existing.id, "waiting_for_openai");
      return { transcriptId: existing.id, rawText: null, waitingForOpenai: true, error: null };
    }

    const { data: row, error } = await transcriptsRepo.create({
      ingestion_id: input.ingestionId,
      lesson_id: input.lessonId ?? null,
      file_path: input.filePath,
      status: "waiting_for_openai",
      word_count: 0,
      metadata: { model: "whisper-1" } as Json,
    });

    logExpertBrain("transcribe", {
      ingestionId: input.ingestionId,
      status: "waiting_for_openai",
      reason: "OPENAI_API_KEY missing",
    });

    return {
      transcriptId: row?.id ?? null,
      rawText: null,
      waitingForOpenai: true,
      error: error ?? null,
    };
  }

  logExpertBrain("transcribe", {
    ingestionId: input.ingestionId,
    fileName: input.fileName,
    model: "whisper-1",
  });

  const buffer = await downloadExpertBrainFile(input.filePath);
  if (!buffer) {
    return { transcriptId: null, rawText: null, waitingForOpenai: false, error: "Download do vídeo falhou." };
  }

  const rawText = await transcribeVideoBuffer(buffer, input.fileName);
  if (!rawText?.trim()) {
    return {
      transcriptId: null,
      rawText: null,
      waitingForOpenai: false,
      error: "Whisper não retornou texto para o vídeo.",
    };
  }

  const { path: transcriptPath, error: uploadError } = await uploadTranscriptText(
    ctx.userId,
    input.fileName,
    rawText
  );

  if (uploadError || !transcriptPath) {
    return { transcriptId: null, rawText: null, waitingForOpenai: false, error: uploadError ?? "Upload da transcrição falhou." };
  }

  const wordCount = countWords(rawText);
  const { data: existing } = await transcriptsRepo.findByIngestionId(input.ingestionId);

  if (existing) {
    await transcriptsRepo.update(existing.id, {
      transcript_path: transcriptPath,
      word_count: wordCount,
      status: "ready",
      error: null,
      lesson_id: input.lessonId ?? existing.lesson_id,
    });
    return { transcriptId: existing.id, rawText, waitingForOpenai: false, error: null };
  }

  const { data: row, error } = await transcriptsRepo.create({
    ingestion_id: input.ingestionId,
    lesson_id: input.lessonId ?? null,
    file_path: input.filePath,
    transcript_path: transcriptPath,
    word_count: wordCount,
    status: "ready",
    metadata: { model: "whisper-1" } as Json,
  });

  return { transcriptId: row?.id ?? null, rawText, waitingForOpenai: false, error: error ?? null };
}

export async function getExpertTranscriptForLesson(lessonId: string): Promise<{
  transcript: import("@/types/database").ExpertTranscript | null;
  text: string | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { transcript: null, text: null, error: "Usuário não autenticado." };

  const transcriptsRepo = new ExpertTranscriptsRepository(ctx.supabase, ctx.userId);
  const { data: transcript, error } = await transcriptsRepo.findByLessonId(lessonId);
  if (error || !transcript) {
    return { transcript: null, text: null, error: error ?? "Transcrição não encontrada." };
  }

  if (transcript.transcript_path) {
    const { text, error: downloadError } = await downloadExpertBrainTranscript(transcript.transcript_path);
    return { transcript, text, error: downloadError };
  }

  return { transcript, text: null, error: null };
}

export async function getExpertTranscriptById(transcriptId: string): Promise<{
  transcript: import("@/types/database").ExpertTranscript | null;
  text: string | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { transcript: null, text: null, error: "Usuário não autenticado." };

  const transcriptsRepo = new ExpertTranscriptsRepository(ctx.supabase, ctx.userId);
  const { data: transcript, error } = await transcriptsRepo.findById(transcriptId);
  if (error || !transcript) {
    return { transcript: null, text: null, error: error ?? "Transcrição não encontrada." };
  }

  if (transcript.transcript_path) {
    const { text, error: downloadError } = await downloadExpertBrainTranscript(transcript.transcript_path);
    return { transcript, text, error: downloadError };
  }

  return { transcript, text: null, error: null };
}
