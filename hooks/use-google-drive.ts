"use client";

import { useCallback, useEffect, useState } from "react";
import type { DriveItem } from "@/lib/google-drive/client";
import { parseJsonResponse } from "@/utils/safe-json";

export type GoogleDrivePathSegment = {
  id: string;
  name: string;
};

export type SelectedGoogleDriveFolder = {
  id: string;
  name: string;
};

export function useGoogleDrive() {
  const [connected, setConnected] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [folders, setFolders] = useState<DriveItem[]>([]);
  const [files, setFiles] = useState<DriveItem[]>([]);
  const [drivePath, setDrivePath] = useState<GoogleDrivePathSegment[]>([
    { id: "root", name: "Meu Drive" },
  ]);
  const [selectedFolder, setSelectedFolder] = useState<SelectedGoogleDriveFolder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFolders = useCallback(async (parentId?: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const qs =
        parentId && parentId !== "root"
          ? `?parentId=${encodeURIComponent(parentId)}`
          : "";
      const res = await fetch(`/api/google-drive/folders${qs}`);
      const { data, error: parseError } = await parseJsonResponse<{
        folders?: DriveItem[];
        email?: string | null;
        accountName?: string | null;
        connected?: boolean;
        expired?: boolean;
        needsReconnect?: boolean;
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        const reconnect = Boolean(data?.needsReconnect || data?.expired);
        setConnected(false);
        setNeedsReconnect(reconnect);
        setFolders([]);
        setFiles([]);
        setError(
          reconnect
            ? "Google Drive precisa ser reconectado"
            : (data?.error ?? parseError ?? "Erro ao listar pastas.")
        );
        if (data?.email) setEmail(data.email);
        if (data?.accountName) setAccountName(data.accountName);
        return;
      }

      setConnected(Boolean(data?.connected));
      setNeedsReconnect(Boolean(data?.needsReconnect || data?.expired));
      setEmail(data?.email ?? null);
      setAccountName(data?.accountName ?? null);
      setFolders(data?.folders ?? []);
    } finally {
      setBusy(false);
    }
  }, []);

  const loadFiles = useCallback(async (folderId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/google-drive/files?folderId=${encodeURIComponent(folderId)}`);
      const { data, error: parseError } = await parseJsonResponse<{
        files?: DriveItem[];
        error?: string;
      }>(res);

      if (parseError || !res.ok || data?.error) {
        setFiles([]);
        setError(data?.error ?? parseError ?? "Erro ao listar arquivos.");
        return;
      }

      setFiles(data?.files ?? []);
    } finally {
      setBusy(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const current = drivePath[drivePath.length - 1];
    const parentId = current?.id === "root" ? undefined : current?.id;
    await loadFolders(parentId);
    if (current && current.id !== "root") {
      await loadFiles(current.id);
    } else {
      setFiles([]);
    }
  }, [drivePath, loadFolders, loadFiles]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  function connect() {
    window.location.href = "/api/google-drive/auth";
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/google-drive/disconnect", { method: "POST" });
      const { data, error: parseError } = await parseJsonResponse<{ error?: string }>(res);

      if (parseError || !res.ok || data?.error) {
        setError(data?.error ?? parseError ?? "Erro ao desconectar.");
        return false;
      }

      setConnected(false);
      setNeedsReconnect(false);
      setEmail(null);
      setAccountName(null);
      setFolders([]);
      setFiles([]);
      setDrivePath([{ id: "root", name: "Meu Drive" }]);
      setSelectedFolder(null);
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function browseFolder(folder: DriveItem) {
    setDrivePath((prev) => [...prev, { id: folder.id, name: folder.name }]);
    await loadFolders(folder.id);
    await loadFiles(folder.id);
  }

  function navigateToPath(index: number) {
    const nextPath = drivePath.slice(0, index + 1);
    setDrivePath(nextPath);
    setSelectedFolder(null);
    const folder = nextPath[nextPath.length - 1];
    const parentId = folder.id === "root" ? undefined : folder.id;
    void loadFolders(parentId);
    if (folder.id === "root") {
      setFiles([]);
    } else {
      void loadFiles(folder.id);
    }
  }

  function selectFolder(folder: SelectedGoogleDriveFolder) {
    setSelectedFolder(folder);
  }

  function selectCurrentFolder() {
    const current = drivePath[drivePath.length - 1];
    if (!current || current.id === "root") return;
    setSelectedFolder({ id: current.id, name: current.name });
  }

  async function importSelectedFolder(): Promise<{ queued: number; error: string | null }> {
    if (!selectedFolder) {
      return { queued: 0, error: "Selecione uma pasta do curso." };
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/google-drive/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: selectedFolder.id,
          folderName: selectedFolder.name,
        }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        queued?: number;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        const message = data?.error ?? parseError ?? "Erro ao importar.";
        setError(message);
        return { queued: 0, error: message };
      }

      if (data?.error && !data.queued) {
        setError(data.error);
        return { queued: 0, error: data.error };
      }

      return { queued: data?.queued ?? 0, error: data?.error ?? null };
    } finally {
      setBusy(false);
    }
  }

  return {
    connected,
    needsReconnect,
    email,
    accountName,
    folders,
    files,
    drivePath,
    selectedFolder,
    busy,
    error,
    connect,
    disconnect,
    refresh,
    browseFolder,
    navigateToPath,
    selectFolder,
    selectCurrentFolder,
    importSelectedFolder,
    setError,
  };
}
