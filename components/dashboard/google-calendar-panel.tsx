"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Cloud, CloudOff, Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useGoogleCalendar } from "@/hooks/use-google-calendar";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";

type GoogleCalendarPanelProps = {
  onImported?: () => void;
};

export function GoogleCalendarPanel({ onImported }: GoogleCalendarPanelProps) {
  const searchParams = useSearchParams();
  const { status, loading, actionLoading, connect, disconnect, importEvents } =
    useGoogleCalendar();

  useEffect(() => {
    const google = searchParams.get("google");
    if (google === "connected") {
      const imported = Number(searchParams.get("imported") ?? "0");
      const updated = Number(searchParams.get("updated") ?? "0");
      if (imported > 0 || updated > 0) {
        toast.success(
          `Google Calendar conectado. ${imported} evento(s) importado(s), ${updated} atualizado(s).`
        );
      } else {
        toast.success("Google Calendar conectado.");
      }
      onImported?.();
    } else if (google === "no_refresh") {
      toast.error("Conexão incompleta. Desconecte e conecte novamente com consentimento total.");
    } else if (google === "save_error") {
      const msg = searchParams.get("msg");
      toast.error(msg ?? "Não foi possível salvar a conexão Google.");
    } else if (google === "unconfigured") {
      toast.error("Google Calendar não está configurado no servidor.");
    } else if (google === "error" || google === "denied") {
      toast.error("Não foi possível conectar ao Google Calendar.");
    }
  }, [searchParams, onImported]);

  async function handleImport() {
    const result = await importEvents();
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `Importação concluída: ${result.imported} novo(s), ${result.updated} atualizado(s).`
    );
    onImported?.();
  }

  async function handleDisconnect() {
    if (!confirm("Desconectar Google Calendar? Os eventos na Aura permanecem.")) return;
    const { error } = await disconnect();
    if (error) toast.error(error);
    else toast.success("Google Calendar desconectado.");
  }

  return (
    <Panel className="border-white/[0.06]">
      <PanelHeader>
        <div className="flex items-center gap-2">
          <Cloud className="size-4 text-sky-400" />
          <PanelTitle>Google Calendar</PanelTitle>
        </div>
      </PanelHeader>
      <PanelContent className="space-y-2 pt-0 text-[12px]">
        {loading ? (
          <div className="flex items-center gap-2 text-zinc-500">
            <Loader2 className="size-3.5 animate-spin" />
            Verificando conexão...
          </div>
        ) : !status.configured ? (
          <p className="text-zinc-500">
            Integração não configurada no servidor (GOOGLE_CLIENT_ID / SECRET). O calendário
            continua funcionando só com Supabase.
          </p>
        ) : status.connected ? (
          <>
            <p className="text-zinc-400">
              Conectado como{" "}
              <span className="text-zinc-200">{status.email ?? "conta Google"}</span>
            </p>
            <p className="text-[11px] text-zinc-600">
              Novos eventos na Aura são enviados ao Google. Use importar para trazer eventos do
              Google.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void handleImport()}
                className="inline-flex items-center gap-1 rounded-md border border-sky-500/25 bg-sky-500/10 px-2.5 py-1.5 text-[11px] text-sky-200 hover:bg-sky-500/15 disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Download className="size-3" />
                )}
                Importar do Google
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void handleDisconnect()}
                className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-zinc-400 hover:bg-white/[0.04] disabled:opacity-50"
              >
                <CloudOff className="size-3" />
                Desconectar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-zinc-500">
              Conecte sua conta Google para sincronizar eventos. Sem conexão, tudo funciona
              normalmente no Supabase.
            </p>
            <button
              type="button"
              disabled={actionLoading}
              onClick={connect}
              className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              <RefreshCw className="size-3" />
              Conectar Google
            </button>
          </>
        )}
      </PanelContent>
    </Panel>
  );
}
