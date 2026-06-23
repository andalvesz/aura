import type { Json } from "@/types/database";
import {
  isDriveProcessable,
  listDriveFolderContents,
  listDriveFolders,
  type DriveItem,
} from "@/lib/google-drive/client";
import { getGoogleDriveOAuthConfig } from "@/lib/google-drive";
import { refreshGoogleAccessToken, tokenExpiresAt } from "@/lib/google-calendar/oauth";
import { GoogleDriveConnectionsRepository } from "@/lib/supabase/repositories/google-drive.repository";
import { ExpertIngestionQueueRepository } from "@/lib/supabase/repositories/expert-brain.repository";
import { getDataContext, getOptionalDataContext } from "./context";

export type GoogleDriveConnectionStatus = {
  connected: boolean;
  configured: boolean;
  email: string | null;
  accountName: string | null;
};

export async function getGoogleDriveConnectionStatus(): Promise<GoogleDriveConnectionStatus> {
  const configured = Boolean(getGoogleDriveOAuthConfig());
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { connected: false, configured, email: null, accountName: null };
  }

  const repo = new GoogleDriveConnectionsRepository(ctx.supabase, ctx.userId);
  const { data } = await repo.findForUser();

  return {
    connected: Boolean(data?.access_token && data?.refresh_token),
    configured,
    email: data?.google_email ?? null,
    accountName: data?.google_display_name ?? null,
  };
}

export async function saveGoogleDriveExpertConnection(params: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  email?: string | null;
  displayName?: string | null;
}): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new GoogleDriveConnectionsRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.upsert({
    google_email: params.email ?? null,
    google_display_name: params.displayName ?? null,
    access_token: params.accessToken,
    refresh_token: params.refreshToken,
    expires_at: tokenExpiresAt(params.expiresIn),
  });

  return { error: error ?? null };
}

export async function disconnectGoogleDriveExpert(): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new GoogleDriveConnectionsRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.deleteForUser();
  return { error: error ?? null };
}

export async function getValidGoogleDriveExpertAccessToken(): Promise<{
  accessToken: string | null;
  error: string | null;
}> {
  const oauth = getGoogleDriveOAuthConfig();
  if (!oauth) {
    return { accessToken: null, error: "Google Drive não configurado no servidor." };
  }

  const ctx = await getOptionalDataContext();
  if (!ctx) return { accessToken: null, error: "Usuário não autenticado." };

  const repo = new GoogleDriveConnectionsRepository(ctx.supabase, ctx.userId);
  const { data: connection, error: connError } = await repo.findForUser();

  if (connError || !connection?.access_token) {
    return { accessToken: null, error: connError ?? "Google Drive não conectado." };
  }

  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
  const needsRefresh = !connection.expires_at || expiresAt - Date.now() < 60_000;

  if (!needsRefresh) {
    return { accessToken: connection.access_token, error: null };
  }

  if (!connection.refresh_token) {
    return { accessToken: null, error: "Refresh token ausente." };
  }

  try {
    const refreshed = await refreshGoogleAccessToken(
      connection.refresh_token,
      oauth.clientId,
      oauth.clientSecret
    );

    const { supabase, userId } = await getDataContext();
    const updateRepo = new GoogleDriveConnectionsRepository(supabase, userId);
    const { error: updateError } = await updateRepo.upsert({
      google_email: connection.google_email,
      google_display_name: connection.google_display_name,
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? connection.refresh_token,
      expires_at: tokenExpiresAt(refreshed.expires_in),
    });

    if (updateError) {
      return { accessToken: null, error: updateError };
    }

    return { accessToken: refreshed.access_token, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao renovar token Google Drive.";
    return { accessToken: null, error: message };
  }
}

export async function listGoogleDriveFolders(parentId?: string | null): Promise<{
  folders: DriveItem[];
  email: string | null;
  accountName: string | null;
  error: string | null;
}> {
  const status = await getGoogleDriveConnectionStatus();
  const { accessToken, error } = await getValidGoogleDriveExpertAccessToken();

  if (!accessToken) {
    return {
      folders: [],
      email: status.email,
      accountName: status.accountName,
      error: error ?? "Google Drive não conectado.",
    };
  }

  try {
    const folders = await listDriveFolders(accessToken, parentId);
    return {
      folders,
      email: status.email,
      accountName: status.accountName,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao listar pastas.";
    return { folders: [], email: status.email, accountName: status.accountName, error: message };
  }
}

export async function listGoogleDriveFiles(folderId: string): Promise<{
  files: DriveItem[];
  error: string | null;
}> {
  const { accessToken, error } = await getValidGoogleDriveExpertAccessToken();
  if (!accessToken) {
    return { files: [], error: error ?? "Google Drive não conectado." };
  }

  if (!folderId?.trim()) {
    return { files: [], error: "Informe folderId." };
  }

  try {
    const contents = await listDriveFolderContents(accessToken, folderId);
    return {
      files: contents.filter((item) => !item.isFolder),
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao listar arquivos.";
    return { files: [], error: message };
  }
}

function isImportableDriveFile(item: DriveItem): boolean {
  if (item.isFolder) return false;
  return isDriveProcessable(item);
}

export async function importGoogleDriveFolder(input: {
  folderId: string;
  folderName: string;
}): Promise<{ queued: number; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { queued: 0, error: "Usuário não autenticado." };

  const folderId = input.folderId?.trim();
  const folderName = input.folderName?.trim();
  if (!folderId || !folderName) {
    return { queued: 0, error: "Informe pasta do curso." };
  }

  const { accessToken, error: tokenError } = await getValidGoogleDriveExpertAccessToken();
  if (!accessToken) {
    return { queued: 0, error: tokenError ?? "Google Drive não conectado." };
  }

  let contents: DriveItem[];
  try {
    contents = await listDriveFolderContents(accessToken, folderId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao ler pasta.";
    return { queued: 0, error: message };
  }

  const importable = contents.filter(isImportableDriveFile);
  if (!importable.length) {
    return {
      queued: 0,
      error: "Nenhum arquivo importável nesta pasta (PDF, TXT, MD ou vídeo MP4).",
    };
  }

  const ingestionRepo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
  let queued = 0;

  for (const file of importable) {
    const { error } = await ingestionRepo.create({
      file_path: `google-drive://${file.id}`,
      course_name: folderName,
      module_name: null,
      lesson_name: file.name.replace(/\.[^.]+$/, ""),
      file_name: file.name,
      status: "pending_drive",
      progress: 0,
      metadata: {
        source: "google_drive",
        drive_file_id: file.id,
        drive_mime_type: file.mimeType,
        drive_folder_id: folderId,
        drive_folder_name: folderName,
      } as Json,
    });

    if (!error) queued += 1;
  }

  return { queued, error: queued === 0 ? "Nenhum arquivo foi enfileirado." : null };
}
