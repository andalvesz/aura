"use client";

import { useCallback, useState } from "react";
import type { ExpertBrainDashboard } from "@/utils/expert-brain-dashboard";
import { parseJsonResponse } from "@/utils/safe-json";
import { useMountFetch } from "./use-mount-fetch";

export type ExpertUploadMode = "zip" | "videos" | "pdfs" | "transcripts";

export function useExpertBrain() {
  const [dashboard, setDashboard] = useState<ExpertBrainDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/expert-brain");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: ExpertBrainDashboard;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar Expert Brain.");
        setDashboard(null);
        return;
      }

      setDashboard(data.dashboard ?? null);
    } catch {
      setError("Erro de conexão.");
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadFiles = useCallback(
    async (params: {
      mode: ExpertUploadMode;
      files: FileList | File[];
      courseTitle?: string;
      author?: string;
      niche?: string;
    }) => {
      setBusy(true);
      try {
        const formData = new FormData();
        formData.set("mode", params.mode);
        if (params.courseTitle) formData.set("courseTitle", params.courseTitle);
        if (params.author) formData.set("author", params.author);
        if (params.niche) formData.set("niche", params.niche);

        for (const file of Array.from(params.files)) {
          formData.append("files", file);
        }

        const res = await fetch("/api/expert-brain/upload", { method: "POST", body: formData });
        const { data, error: parseError } = await parseJsonResponse<{
          error?: string;
          message?: string;
          queued?: number;
        }>(res);

        if (parseError || !res.ok || data?.error) {
          return { error: data?.error ?? parseError ?? "Erro no upload." };
        }

        await refresh();
        return { error: null, message: data?.message ?? "Upload concluído.", queued: data?.queued ?? 0 };
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const processQueue = useCallback(async (limit = 5) => {
    setBusy(true);
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

      await refresh();
      return { error: null, message: data?.message ?? "Fila processada.", processed: data?.processed ?? 0 };
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const reprocess = useCallback(
    async (entityType: "lesson" | "module" | "course", entityId: string) => {
      setBusy(true);
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

        await refresh();
        return { error: null, message: data?.message ?? "Reprocessado." };
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  useMountFetch(refresh, [refresh]);

  return {
    dashboard,
    loading,
    error,
    busy,
    refresh,
    uploadFiles,
    processQueue,
    reprocess,
  };
}
