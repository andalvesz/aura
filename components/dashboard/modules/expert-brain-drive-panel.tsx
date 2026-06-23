"use client";

import { useEffect } from "react";
import {
  ChevronRight,
  File,
  FileText,
  Folder,
  HardDrive,
  Loader2,
  LogOut,
  RefreshCw,
  Video,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useGoogleDrive } from "@/hooks/use-google-drive";
import { cn } from "@/utils/cn";
import type { DriveItem } from "@/lib/google-drive/client";

function DriveFileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("video/")) {
    return <Video className="size-3.5 text-violet-400" />;
  }
  if (mimeType === "application/pdf" || mimeType.startsWith("text/")) {
    return <FileText className="size-3.5 text-sky-400" />;
  }
  return <File className="size-3.5 text-zinc-400" />;
}

type ExpertBrainDrivePanelProps = {
  busy?: boolean;
  onImported?: () => void;
};

export function ExpertBrainDrivePanel({ busy: externalBusy, onImported }: ExpertBrainDrivePanelProps) {
  const searchParams = useSearchParams();
  const {
    connected,
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
  } = useGoogleDrive();

  useEffect(() => {
    if (searchParams.get("drive_connected")) {
      toast.success("Google Drive conectado.");
      void refresh();
    }
    const driveError = searchParams.get("drive_error");
    if (driveError) toast.error(`Drive: ${driveError}`);
  }, [searchParams, refresh]);

  const isBusy = busy || Boolean(externalBusy);
  const currentFolder = drivePath[drivePath.length - 1];
  const canSelectCurrentFolder = currentFolder && currentFolder.id !== "root";
  const insideFolder = currentFolder && currentFolder.id !== "root";

  async function handleDisconnect() {
    const ok = await disconnect();
    if (ok) toast.success("Google Drive desconectado.");
  }

  async function handleImport() {
    const { queued, error: importError } = await importSelectedFolder();
    if (importError && queued === 0) {
      toast.error(importError);
      return;
    }
    toast.success(
      `${queued} arquivo(s) enfileirado(s). O processamento (download, transcrição e extração) continua em segundo plano.`
    );
    onImported?.();
  }

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2 text-[13px]">
          <HardDrive className="size-3.5 text-cyan-400" />
          Google Drive
        </PanelTitle>
        {connected && (
          <div className="flex flex-wrap gap-2">
            <ActionButton variant="ghost" onClick={() => void refresh()} disabled={isBusy}>
              <RefreshCw className={cn("size-3.5", isBusy && "animate-spin")} />
              Atualizar
            </ActionButton>
            <ActionButton variant="ghost" onClick={() => void handleDisconnect()} disabled={isBusy}>
              <LogOut className="size-3.5" />
              Desconectar
            </ActionButton>
          </div>
        )}
      </PanelHeader>
      <PanelContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-red-500/20 bg-red-500/[0.04] px-3 py-2 text-[11px] text-red-300">
            {error}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => setError(null)}
            >
              fechar
            </button>
          </div>
        )}

        {!connected ? (
          <div className="space-y-3">
            <p className="text-[12px] text-zinc-400">
              Conecte sua conta Google para navegar nas pastas do Drive e importar cursos (PDF, TXT,
              MD e vídeos MP4) para o Expert Brain.
            </p>
            <ActionButton onClick={connect}>Conectar Google Drive</ActionButton>
          </div>
        ) : (
          <>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[12px] font-medium text-zinc-100">
                {accountName ?? "Conta Google"}
              </p>
              <p className="text-[11px] text-zinc-500">{email}</p>
            </div>

            {selectedFolder && (
              <div className="rounded-md border border-cyan-500/20 bg-cyan-500/[0.04] px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-cyan-400">
                  Pasta do curso selecionada
                </p>
                <p className="text-[12px] font-medium text-cyan-100">{selectedFolder.name}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1 text-[11px] text-zinc-400">
              {drivePath.map((segment, index) => (
                <span key={`${segment.id}-${index}`} className="flex items-center gap-1">
                  {index > 0 && <ChevronRight className="size-3 text-zinc-600" />}
                  <button
                    type="button"
                    onClick={() => navigateToPath(index)}
                    className={cn(
                      "rounded px-1.5 py-0.5 transition-colors hover:bg-white/[0.04] hover:text-zinc-200",
                      index === drivePath.length - 1 && "font-medium text-zinc-200"
                    )}
                  >
                    {segment.name}
                  </button>
                </span>
              ))}
            </div>

            {canSelectCurrentFolder && (
              <ActionButton variant="ghost" onClick={selectCurrentFolder} disabled={isBusy}>
                Selecionar pasta atual
              </ActionButton>
            )}

            {isBusy && folders.length === 0 && !insideFolder ? (
              <div className="flex items-center gap-2 py-4 text-[12px] text-zinc-500">
                <Loader2 className="size-4 animate-spin" />
                Carregando pastas…
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                  Pastas ({folders.length})
                </p>
                {!folders.length ? (
                  <p className="px-2 py-1.5 text-[11px] text-zinc-600">Nenhuma pasta aqui.</p>
                ) : (
                  folders.map((folder: DriveItem) => (
                    <div
                      key={folder.id}
                      className="flex items-center gap-1 rounded-md hover:bg-white/[0.04]"
                    >
                      <button
                        type="button"
                        onClick={() => void browseFolder(folder)}
                        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-[12px] text-zinc-200"
                      >
                        <Folder className="size-3.5 shrink-0 text-amber-400" />
                        <span className="truncate">{folder.name}</span>
                        <ChevronRight className="ml-auto size-3 shrink-0 text-zinc-600" />
                      </button>
                      <button
                        type="button"
                        title="Selecionar pasta do curso"
                        onClick={() => selectFolder({ id: folder.id, name: folder.name })}
                        className={cn(
                          "shrink-0 rounded px-2 py-1 text-[10px] transition-colors",
                          selectedFolder?.id === folder.id
                            ? "bg-cyan-500/20 text-cyan-200"
                            : "text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
                        )}
                      >
                        Selecionar
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {insideFolder && (
              <div className="space-y-1 border-t border-white/[0.06] pt-3">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                  Arquivos ({files.length})
                </p>
                {!files.length ? (
                  <p className="px-2 py-1.5 text-[11px] text-zinc-600">Nenhum arquivo aqui.</p>
                ) : (
                  files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5"
                    >
                      <DriveFileIcon mimeType={file.mimeType} />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-200">
                        {file.name}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            <ActionButton
              onClick={() => void handleImport()}
              disabled={isBusy || !selectedFolder}
            >
              {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Importar do Google Drive
            </ActionButton>
          </>
        )}
      </PanelContent>
    </Panel>
  );
}
