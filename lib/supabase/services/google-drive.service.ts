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
import { isInvalidGrantError } from "@/utils/google-drive-oauth-errors";
import { getDataContext, getOptionalDataContext } from "./context";

export type GoogleDriveConnectionStatus = {
  connected: boolean;
  configured: boolean;
  expired: boolean;
  needsReconnect: boolean;
  email: string | null;
  accountName: string | null;
  lastError: string | null;
};

export async function getGoogleDriveConnectionStatus(): Promise<GoogleDriveConnectionStatus> {
  const configured = Boolean(getGoogleDriveOAuthConfig());
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      connected: false,
      configured,
      expired: false,
      needsReconnect: false,
      email: null,
      accountName: null,
      lastError: null,
    };
  }

  const repo = new GoogleDriveConnectionsRepository(ctx.supabase, ctx.userId);
  const { data } = await repo.findForUser();
  const hasTokens = Boolean(data?.access_token && data?.refresh_token);
  const expired = data?.status === "expired";

  return {
    connected: hasTokens && !expired,
    configured,
    expired,
    needsReconnect: expired || (hasTokens === false && Boolean(data)),
    email: data?.google_email ?? null,
    accountName: data?.google_display_name ?? null,
    lastError: data?.last_error ?? null,
  };
}

export async function markGoogleDriveConnectionExpired(
  lastError: string
): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new GoogleDriveConnectionsRepository(ctx.supabase, ctx.userId);
  return repo.markExpired(lastError);
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
    status: "active",
    last_error: null,
  });

  return { error: error ?? null };
}

/**
 * After OAuth reconnect: keep chunk progress, re-attach Drive-waiting items as pending_drive.
 * Never resets AIF chunk metadata / progress to zero.
 */
export async function requeueDriveItemsAfterOAuthReconnect(): Promise<{
  requeued: number;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { requeued: 0, error: "Usuário não autenticado." };

  const ingestionRepo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
  const { data: items, error } = await ingestionRepo.findDriveReconnectCandidates(500);
  if (error) return { requeued: 0, error };

  let requeued = 0;
  for (const item of items ?? []) {
    const result = await ingestionRepo.markPendingDriveForReconnect(item.id, {
      preserveProgress: true,
      clearLastError: true,
    });
    if (!result.error) requeued += 1;
  }

  return { requeued, error: null };
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
  expired?: boolean;
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

  if (connection.status === "expired") {
    return {
      accessToken: null,
      error: connection.last_error ?? "Google Drive precisa ser reconectado",
      expired: true,
    };
  }

  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
  const needsRefresh = !connection.expires_at || expiresAt - Date.now() < 60_000;

  if (!needsRefresh) {
    return { accessToken: connection.access_token, error: null };
  }

  if (!connection.refresh_token) {
    await repo.markExpired("Refresh token ausente.");
    return { accessToken: null, error: "Refresh token ausente.", expired: true };
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
      status: "active",
      last_error: null,
    });

    if (updateError) {
      return { accessToken: null, error: updateError };
    }

    return { accessToken: refreshed.access_token, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao renovar token Google Drive.";
    if (isInvalidGrantError(message)) {
      await repo.markExpired(message);
      return {
        accessToken: null,
        error: "Google Drive precisa ser reconectado",
        expired: true,
      };
    }
    return { accessToken: null, error: message };
  }
}

export async function listGoogleDriveFolders(parentId?: string | null): Promise<{
  folders: DriveItem[];
  email: string | null;
  accountName: string | null;
  expired: boolean;
  needsReconnect: boolean;
  error: string | null;
}> {
  const status = await getGoogleDriveConnectionStatus();
  const { accessToken, error, expired } = await getValidGoogleDriveExpertAccessToken();

  if (!accessToken) {
    return {
      folders: [],
      email: status.email,
      accountName: status.accountName,
      expired: Boolean(expired || status.expired),
      needsReconnect: Boolean(expired || status.needsReconnect || status.expired),
      error: error ?? "Google Drive não conectado.",
    };
  }

  try {
    const folders = await listDriveFolders(accessToken, parentId);
    return {
      folders,
      email: status.email,
      accountName: status.accountName,
      expired: false,
      needsReconnect: false,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao listar pastas.";
    if (isInvalidGrantError(message)) {
      await markGoogleDriveConnectionExpired(message);
      return {
        folders: [],
        email: status.email,
        accountName: status.accountName,
        expired: true,
        needsReconnect: true,
        error: "Google Drive precisa ser reconectado",
      };
    }
    return {
      folders: [],
      email: status.email,
      accountName: status.accountName,
      expired: false,
      needsReconnect: false,
      error: message,
    };
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
    if (isInvalidGrantError(message)) {
      await markGoogleDriveConnectionExpired(message);
      return { files: [], error: "Google Drive precisa ser reconectado" };
    }
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
  console.info("[drive-import] folder", { folderId, folderName, userId: ctx.userId });
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
    console.error("[drive-import] folder", {
      stage: "listDriveFolderContents",
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    if (isInvalidGrantError(message)) {
      await markGoogleDriveConnectionExpired(message);
      return { queued: 0, error: "Google Drive precisa ser reconectado" };
    }
    return { queued: 0, error: message };
  }

  const importable = contents.filter(isImportableDriveFile);
  console.info("[drive-import] files", {
    total: contents.length,
    importable: importable.length,
    files: importable.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType })),
    skipped: contents
      .filter((f) => !isImportableDriveFile(f))
      .map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, isFolder: f.isFolder })),
  });
  if (!importable.length) {
    return {
      queued: 0,
      error: "Nenhum arquivo importável nesta pasta (PDF, TXT, MD ou vídeo MP4).",
    };
  }

  const ingestionRepo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
  let queued = 0;
  const queueErrors: string[] = [];

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

    if (!error) {
      queued += 1;
    } else {
      queueErrors.push(`${file.name}: ${error}`);
    }
  }

  console.info("[drive-import] queue", { queued, failed: queueErrors.length, queueErrors });
  return { queued, error: queued === 0 ? "Nenhum arquivo foi enfileirado." : null };
}
