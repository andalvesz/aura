"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ExpertBrainDashboard } from "@/utils/expert-brain-dashboard";
import {
  EXPERT_BRAIN_FILES_BUCKET,
  EXPERT_BRAIN_MAX_FILE_SIZE,
  buildExpertBrainStoragePath,
  formatExpertBrainStorageUploadError,
  guessExpertBrainContentType,
  titleFromExpertBrainFileName,
  validateExpertBrainFileSize,
  validateExpertBrainFileType,
  type ExpertBrainUploadMode,
} from "@/utils/expert-brain-storage";
import { parseJsonResponse } from "@/utils/safe-json";
import { useMountFetch } from "./use-mount-fetch";

export type ExpertUploadMode = ExpertBrainUploadMode;

export type ExpertUploadProgress = {
  fileName: string;
  percent: number;
  status: "uploading" | "registering" | "done" | "failed";
  error?: string;
};

const MODE_MODULE_LABEL: Record<ExpertUploadMode, string> = {
  zip: "Importado",
  videos: "Vídeos",
  pdfs: "PDFs",
  transcripts: "Transcrições",
};

export function useExpertBrain() {
  const [dashboard, setDashboard] = useState<ExpertBrainDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<ExpertUploadProgress[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch("/api/expert-brain");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: ExpertBrainDashboard;
        warnings?: Array<{ table: string; message: string }>;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        if (!silent) {
          setError(data?.error ?? parseError ?? "Erro ao carregar Expert Brain.");
          setDashboard(null);
        }
        return;
      }

      if (data.warnings?.length) {
        console.warn("[expert-brain-dashboard] partial load warnings", data.warnings);
      }

      setDashboard(data.dashboard ?? null);
    } catch {
      if (!silent) {
        setError("Erro de conexão.");
        setDashboard(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(() => {
      void refresh(true);
    }, 2500);
  }, [refresh, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    const ingestion = dashboard?.ingestionQueue ?? [];
    const activeStatuses = new Set([
      "pending_drive",
      "downloaded",
      "uploaded",
      "transcribing",
      "transcribed",
      "chunking",
      "extracting",
      "extracting_chunk",
      "normalizing_chunk",
      "validating_chunk",
      "committing_chunk",
      "waiting_for_openai",
      "waiting_transcription_retry",
      "pending",
      "processing",
    ]);
    const hasActive = ingestion.some((item) => activeStatuses.has(item.status));
    const hasProcessingLessons =
      (dashboard?.metrics.queuePending ?? 0) > 0 ||
      (dashboard?.metrics.queueProcessing ?? 0) > 0;
    const needsReconnect = dashboard?.driveConnection?.needsReconnect;

    if (hasActive || hasProcessingLessons || needsReconnect) startPolling();
    else stopPolling();
  }, [dashboard, startPolling, stopPolling]);

  const uploadToStorage = useCallback(
    async (file: File, userId: string, mode: ExpertUploadMode) => {
      const typeError = validateExpertBrainFileType(file.name, mode);
      if (typeError) throw new Error(typeError);

      const sizeError = validateExpertBrainFileSize(file.size);
      if (sizeError) throw new Error(sizeError);

      console.info("[expert-brain-upload]", {
        fileName: file.name,
        fileSize: file.size,
        maxAllowedSize: EXPERT_BRAIN_MAX_FILE_SIZE,
      });

      const supabase = createClient();
      const storagePath = buildExpertBrainStoragePath(userId, file.name);
      const contentType = file.type || guessExpertBrainContentType(file.name);

      const { error: uploadError } = await supabase.storage
        .from(EXPERT_BRAIN_FILES_BUCKET)
        .upload(storagePath, file, {
          upsert: false,
          contentType,
        });

      if (uploadError) {
        throw new Error(formatExpertBrainStorageUploadError(uploadError.message, file.size));
      }
      return storagePath;
    },
    []
  );

  const registerUploadedFile = useCallback(
    async (params: {
      file_path: string;
      file_name: string;
      course_name?: string;
      module_name?: string;
      lesson_name?: string;
      author?: string;
      niche?: string;
    }) => {
      const res = await fetch("/api/expert-brain/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        error?: string;
        message?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        throw new Error(data?.error ?? parseError ?? "Erro ao registrar arquivo.");
      }

      return data?.message ?? "Registrado.";
    },
    []
  );

  const uploadFiles = useCallback(
    async (params: {
      mode: ExpertUploadMode;
      files: FileList | File[];
      courseTitle?: string;
      author?: string;
      niche?: string;
    }) => {
      setBusy(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setBusy(false);
        return { error: "Usuário não autenticado." };
      }

      const fileList = Array.from(params.files);
      const progresses: ExpertUploadProgress[] = fileList.map((file) => ({
        fileName: file.name,
        percent: 0,
        status: "uploading",
      }));
      setUploadProgress(progresses);
      startPolling();

      try {
        for (let index = 0; index < fileList.length; index++) {
          const file = fileList[index];
          setUploadProgress((prev) =>
            prev.map((item, i) =>
              i === index ? { ...item, percent: 10, status: "uploading" } : item
            )
          );

          const file_path = await uploadToStorage(file, user.id, params.mode);

          setUploadProgress((prev) =>
            prev.map((item, i) =>
              i === index ? { ...item, percent: 70, status: "registering" } : item
            )
          );

          const course_name =
            params.courseTitle?.trim() ||
            (params.mode === "zip" ? titleFromExpertBrainFileName(file.name) : params.courseTitle) ||
            `Upload ${MODE_MODULE_LABEL[params.mode]}`;

          await registerUploadedFile({
            file_path,
            file_name: file.name,
            course_name,
            module_name: params.mode === "zip" ? undefined : MODE_MODULE_LABEL[params.mode],
            lesson_name: params.mode === "zip" ? undefined : titleFromExpertBrainFileName(file.name),
            author: params.author,
            niche: params.niche,
          });

          setUploadProgress((prev) =>
            prev.map((item, i) =>
              i === index ? { ...item, percent: 100, status: "done" } : item
            )
          );
        }

        await refresh(true);
        void fetch("/api/expert-brain-queue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 1 }),
        }).catch(() => undefined);
        return {
          error: null,
          message: `${fileList.length} arquivo(s) enfileirado(s). Processamento assíncrono iniciado.`,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro no upload.";
        setUploadProgress((prev) =>
          prev.map((item) =>
            item.status === "done"
              ? item
              : { ...item, status: "failed", error: message, percent: item.percent }
          )
        );
        return { error: message };
      } finally {
        setBusy(false);
      }
    },
    [refresh, registerUploadedFile, startPolling, uploadToStorage]
  );

  const fetchTranscript = useCallback(async (params: { lessonId?: string; transcriptId?: string }) => {
    const query = params.lessonId
      ? `lessonId=${encodeURIComponent(params.lessonId)}`
      : `transcriptId=${encodeURIComponent(params.transcriptId ?? "")}`;
    const res = await fetch(`/api/expert-brain/transcript?${query}`);
    const { data, error: parseError } = await parseJsonResponse<{
      error?: string;
      transcript?: unknown;
      text?: string | null;
    }>(res);
    if (parseError || !res.ok || data?.error) {
      return { error: data?.error ?? parseError ?? "Erro ao carregar transcrição.", text: null };
    }
    return { error: null, text: data?.text ?? null };
  }, []);

  const fetchKnowledge = useCallback(async (sourceId: string) => {
    const res = await fetch(`/api/expert-brain/knowledge?sourceId=${encodeURIComponent(sourceId)}`);
    const { data, error: parseError } = await parseJsonResponse<{
      error?: string;
      knowledge?: unknown;
    }>(res);
    if (parseError || !res.ok || data?.error) {
      return { error: data?.error ?? parseError ?? "Erro ao carregar conhecimento.", knowledge: null };
    }
    return { error: null, knowledge: data?.knowledge ?? null };
  }, []);

  const processQueue = useCallback(async (limit = 1) => {
    setBusy(true);
    startPolling();
    try {
      const res = await fetch("/api/expert-brain-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        success?: boolean;
        error?: string;
        message?: string;
        processed?: number;
        completed?: number;
        found?: number;
        failed?: number;
        skipped?: number;
        remaining?: number;
        pendingDriveRemaining?: number;
        memorySafe?: boolean;
      }>(res);

      if (parseError) {
        return { error: parseError };
      }

      if (!res.ok || data?.error) {
        return {
          error: data?.message ?? data?.error ?? "Erro ao processar fila.",
          processed: data?.processed ?? 0,
        };
      }

      if (data?.success === false) {
        return {
          error: data.message ?? "Fila não processou itens pendentes.",
          processed: data.processed ?? 0,
        };
      }

      await refresh(true);
      return {
        error: null,
        message: data?.message ?? `Processados: ${data?.processed ?? 0}`,
        processed: data?.processed ?? 0,
      };
    } finally {
      setBusy(false);
    }
  }, [refresh, startPolling]);

  const reprocess = useCallback(
    async (entityType: "lesson" | "module" | "course", entityId: string) => {
      setBusy(true);
      startPolling();
      try {
        const res = await fetch("/api/expert-brain/reprocess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType, entityId }),
        });
        const { data, error: parseError } = await parseJsonResponse<{
          error?: string;
          message?: string;
        }>(res);

        if (parseError || !res.ok || data?.error) {
          return { error: data?.error ?? parseError ?? "Erro ao reprocessar." };
        }

        await refresh(true);
        return { error: null, message: data?.message ?? "Reprocessado." };
      } finally {
        setBusy(false);
      }
    },
    [refresh, startPolling]
  );

  useMountFetch(() => refresh(false), [refresh]);

  return {
    dashboard,
    loading,
    error,
    busy,
    uploadProgress,
    refresh: () => refresh(false),
    uploadFiles,
    processQueue,
    reprocess,
    fetchTranscript,
    fetchKnowledge,
  };
}
