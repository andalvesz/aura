"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Info,
  Loader2,
  ScrollText,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { FORM_SELECT_CLASS } from "@/utils/dashboard-mobile";
import type { SystemLog, SystemLogTipo } from "@/types/database";
import { parseJsonResponse } from "@/utils/safe-json";
import {
  formatSystemLogsExport,
  SYSTEM_LOG_MODULOS,
  SYSTEM_LOG_TIPOS,
  systemLogModuloLabel,
  systemLogTipoLabel,
} from "@/utils/system-logs";
import { cn } from "@/utils/cn";

function TipoIcon({ tipo }: { tipo: SystemLogTipo }) {
  switch (tipo) {
    case "success":
      return <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />;
    case "warning":
      return <AlertTriangle className="size-4 shrink-0 text-amber-400" />;
    case "info":
      return <Info className="size-4 shrink-0 text-sky-400" />;
    case "error":
      return <XCircle className="size-4 shrink-0 text-rose-400" />;
  }
}

function TipoBadge({ tipo }: { tipo: SystemLogTipo }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        tipo === "success" && "bg-emerald-500/10 text-emerald-400",
        tipo === "warning" && "bg-amber-500/10 text-amber-400",
        tipo === "info" && "bg-sky-500/10 text-sky-400",
        tipo === "error" && "bg-rose-500/10 text-rose-400"
      )}
    >
      {systemLogTipoLabel(tipo)}
    </span>
  );
}

export function SystemLogsView() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [tipo, setTipo] = useState<SystemLogTipo | "all">("all");
  const [modulo, setModulo] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (tipo !== "all") params.set("tipo", tipo);
      if (modulo !== "all") params.set("modulo", modulo);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const res = await fetch(`/api/system-logs?${params.toString()}`);
      const { data, error: parseError } = await parseJsonResponse<{
        logs?: SystemLog[];
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        setLoadError(data?.error ?? parseError ?? "Erro ao carregar logs.");
        setLogs([]);
        return;
      }

      setLogs(data?.logs ?? []);
    } catch {
      setLoadError("Erro de conexão.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [tipo, modulo, fromDate, toDate]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  async function handleClear() {
    if (
      !confirm(
        "Limpar logs com os filtros atuais? Esta ação não pode ser desfeita."
      )
    ) {
      return;
    }

    setClearing(true);
    try {
      const params = new URLSearchParams();
      if (tipo !== "all") params.set("tipo", tipo);
      if (modulo !== "all") params.set("modulo", modulo);

      const res = await fetch(`/api/system-logs?${params.toString()}`, {
        method: "DELETE",
      });
      const { data, error: parseError } = await parseJsonResponse<{
        deleted?: number;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        toast.error(data?.error ?? parseError ?? "Não foi possível limpar.");
        return;
      }

      toast.success(`${data?.deleted ?? 0} log(s) removido(s).`);
      await loadLogs();
    } catch {
      toast.error("Erro ao limpar logs.");
    } finally {
      setClearing(false);
    }
  }

  async function handleExport() {
    if (logs.length === 0) {
      toast.error("Nenhum log para exportar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(formatSystemLogsExport(logs));
      toast.success("Logs exportados para a área de transferência.");
    } catch {
      toast.error("Não foi possível exportar.");
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03]">
            <ScrollText className="size-4 text-orange-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-600">
              Sistema
            </p>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-50 sm:text-[22px]">
              Central de Logs
            </h1>
            <p className="mt-0.5 max-w-xl text-[12px] text-zinc-500">
              Erros e eventos importantes registrados automaticamente pela Aura.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/diagnostico"
          className="text-[11px] text-teal-400/90 hover:text-teal-300"
        >
          Abrir diagnóstico →
        </Link>
      </header>

      <Panel>
        <PanelHeader>
          <PanelTitle>Filtros</PanelTitle>
        </PanelHeader>
        <PanelContent className="grid grid-cols-1 gap-3 pt-0 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-[12px] text-zinc-500">
            Tipo
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as SystemLogTipo | "all")}
              className={FORM_SELECT_CLASS}
            >
              <option value="all" className="bg-zinc-900">
                Todos
              </option>
              {SYSTEM_LOG_TIPOS.map((t) => (
                <option key={t} value={t} className="bg-zinc-900">
                  {systemLogTipoLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] text-zinc-500">
            Módulo
            <select
              value={modulo}
              onChange={(e) => setModulo(e.target.value)}
              className={FORM_SELECT_CLASS}
            >
              <option value="all" className="bg-zinc-900">
                Todos
              </option>
              {SYSTEM_LOG_MODULOS.map((m) => (
                <option key={m} value={m} className="bg-zinc-900">
                  {systemLogModuloLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] text-zinc-500">
            De
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={FORM_SELECT_CLASS}
            />
          </label>
          <label className="block text-[12px] text-zinc-500">
            Até
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={FORM_SELECT_CLASS}
            />
          </label>
        </PanelContent>
      </Panel>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <ActionButton
          icon={<ClipboardCopy className="size-3.5" />}
          className="w-full sm:w-auto"
          disabled={logs.length === 0}
          onClick={() => void handleExport()}
        >
          Exportar logs
        </ActionButton>
        <ActionButton
          icon={
            clearing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )
          }
          variant="ghost"
          className="w-full text-rose-400/90 sm:w-auto hover:text-rose-400"
          disabled={clearing || logs.length === 0}
          onClick={() => void handleClear()}
        >
          Limpar logs
        </ActionButton>
        <ActionButton
          variant="ghost"
          className="w-full sm:w-auto"
          disabled={loading}
          onClick={() => void loadLogs()}
        >
          Atualizar
        </ActionButton>
      </div>

      <Panel>
        <PanelHeader className="items-center">
          <PanelTitle>Registros ({logs.length})</PanelTitle>
        </PanelHeader>
        <PanelContent className="pt-0">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-[13px] text-zinc-500">
              <Loader2 className="size-4 animate-spin" />
              Carregando logs...
            </div>
          ) : loadError ? (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-4 text-[12px] text-amber-100/90">
              {loadError}
            </div>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-zinc-600">
              Nenhum log encontrado para os filtros selecionados.
            </p>
          ) : (
            <ul className="max-h-[min(70vh,640px)] space-y-2 overflow-y-auto">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <TipoIcon tipo={log.tipo} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <TipoBadge tipo={log.tipo} />
                        <span className="text-[10px] text-zinc-600">
                          {systemLogModuloLabel(log.modulo)}
                        </span>
                        <span className="text-[10px] tabular-nums text-zinc-700">
                          {new Date(log.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-[13px] text-zinc-200">
                        {log.mensagem}
                      </p>
                      {log.detalhes != null && (
                        <pre className="mt-2 max-h-32 overflow-auto rounded-md bg-zinc-950/50 p-2 text-[10px] leading-relaxed text-zinc-500">
                          {JSON.stringify(log.detalhes, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PanelContent>
      </Panel>
    </div>
  );
}
