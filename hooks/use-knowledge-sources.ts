"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DriveItem } from "@/lib/google-drive/client";
import type { KnowledgeJob, KnowledgeSource } from "@/types/database";
import type { AppliedKnowledge, KnowledgeSourcesDashboard } from "@/utils/knowledge-sources";
import { parseJsonResponse } from "@/utils/safe-json";

export function useKnowledgeSources() {
  const [dashboard, setDashboard] = useState<KnowledgeSourcesDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driveFolders, setDriveFolders] = useState<DriveItem[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveItem[]>([]);
  const [drivePath, setDrivePath] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCourse, setSelectedCourse] = useState<DriveItem | null>(null);
  const [selectedModule, setSelectedModule] = useState<DriveItem | null>(null);
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set());
  const [lastApplied, setLastApplied] = useState<AppliedKnowledge | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge-sources");
      const { data, error: parseError } = await parseJsonResponse<{
        dashboard?: KnowledgeSourcesDashboard;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setError(data?.error ?? parseError ?? "Erro ao carregar fontes.");
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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const browseDrive = useCallback(async (parentId?: string | null) => {
    setBusy(true);
    try {
      const qs = parentId ? `?parentId=${encodeURIComponent(parentId)}` : "";
      const res = await fetch(`/api/knowledge-sources/google/browse${qs}`);
      const { data, error: parseError } = await parseJsonResponse<{
        folders?: DriveItem[];
        files?: DriveItem[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        setError(data?.error ?? parseError ?? "Erro ao listar Drive.");
        return;
      }

      setDriveFolders(data?.folders ?? []);
      setDriveFiles(data?.files ?? []);
    } finally {
      setBusy(false);
    }
  }, []);

  async function connectDrive() {
    window.location.href = "/api/knowledge-sources/google/connect";
  }

  async function uploadFile(file: File, meta?: { courseName?: string; moduleName?: string }) {
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (meta?.courseName) formData.append("course_name", meta.courseName);
      if (meta?.moduleName) formData.append("module_name", meta.moduleName);

      const res = await fetch("/api/knowledge-sources/upload", {
        method: "POST",
        body: formData,
      });
      const { data, error: parseError } = await parseJsonResponse<{
        error?: string;
        source?: KnowledgeSource;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        setError(data?.error ?? parseError ?? "Erro no upload.");
        return false;
      }

      await refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function queueSelectedLessons() {
    if (!selectedCourse || selectedLessons.size === 0) return false;

    const lessons = driveFiles
      .filter((f) => selectedLessons.has(f.id))
      .map((f) => ({
        driveFileId: f.id,
        fileName: f.name,
        mimeType: f.mimeType,
        courseName: selectedCourse.name,
        moduleName: selectedModule?.name ?? null,
        lessonName: f.name.replace(/\.[^.]+$/, ""),
      }));

    setBusy(true);
    try {
      const res = await fetch("/api/knowledge-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "queue_drive", lessons }),
      });
      const { data, error: parseError } = await parseJsonResponse<{ error?: string; queued?: number }>(
        res
      );

      if (parseError || !res.ok || data?.error) {
        setError(data?.error ?? parseError ?? "Erro ao enfileirar.");
        return false;
      }

      setSelectedLessons(new Set());
      await refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function processQueue() {
    setBusy(true);
    try {
      const res = await fetch("/api/knowledge-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process", limit: 3 }),
      });
      await parseJsonResponse(res);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function toggleLesson(id: string) {
    setSelectedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function clearSelectedLessons() {
    setSelectedLessons(new Set());
  }

  return {
    dashboard,
    loading,
    busy,
    error,
    refresh,
    connectDrive,
    uploadFile,
    browseDrive,
    driveFolders,
    driveFiles,
    drivePath,
    setDrivePath,
    selectedCourse,
    setSelectedCourse,
    selectedModule,
    setSelectedModule,
    selectedLessons,
    toggleLesson,
    queueSelectedLessons,
    processQueue,
    clearSelectedLessons,
    lastApplied,
    setLastApplied,
  };
}

export type { KnowledgeSource, KnowledgeJob };
