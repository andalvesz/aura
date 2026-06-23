"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ExpertBrainDashboard } from "@/utils/expert-brain-dashboard";
import {
  EXPERT_BRAIN_FILES_BUCKET,
  buildExpertBrainStoragePath,
  guessExpertBrainContentType,
  titleFromExpertBrainFileName,
  validateExpertBrainFileSize,
} from "@/utils/expert-brain-storage";
import { parseJsonResponse } from "@/utils/safe-json";
import { useMountFetch } from "./use-mount-fetch";

export type ExpertUploadMode = "zip" | "videos" | "pdfs" | "transcripts";

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
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        if (!silent) {
          setError(data?.error ?? parseError ?? "Erro ao carregar Expert Brain.");
          setDashboard(null);
        }
        return;
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
    const hasActive = ingestion.some(
      (item) => item.status === "pending" || item.status === "processing"
    );
    const hasProcessingLessons =
      (dashboard?.metrics.queuePending ?? 0) > 0 ||
      (dashboard?.metrics.queueProcessing ?? 0) > 0;

    if (hasActive || hasProcessingLessons) startPolling();
    else stopPolling();
  }, [dashboard, startPolling, stopPolling]);

  const uploadToStorage = useCallback(
    async (file: File, userId: string) => {
      const sizeError = validateExpertBrainFileSize(file.size);
      if (sizeError) throw new Error(sizeError);

      const supabase = createClient();
      const storagePath = buildExpertBrainStoragePath(userId, file.name);
      const contentType = file.type || guessExpertBrainContentType(file.name);

      const { error: uploadError } = await supabase.storage
        .from(EXPERT_BRAIN_FILES_BUCKET)
        .upload(storagePath, file, {
          upsert: false,
          contentType,
        });

      if (uploadError) throw new Error(uploadError.message);
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

          const file_path = await uploadToStorage(file, user.id);

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
        return { error: null, message: `${fileList.length} arquivo(s) enviado(s) ao Storage.` };
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

  const processQueue = useCallback(async (limit = 5) => {
    setBusy(true);
    startPolling();
    try {
      const res = await fetch("/api/expert-brain/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        error?: string;
        message?: string;
        processed?: number;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        return { error: data?.error ?? parseError ?? "Erro ao processar fila." };
      }

      await refresh(true);
      return { error: null, message: data?.message ?? "Fila processada.", processed: data?.processed ?? 0 };
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
  };
}
