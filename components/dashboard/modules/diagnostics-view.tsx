"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Loader2,
  Play,
  ScrollText,
  Stethoscope,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import type {
  DiagnosticCheck,
  DiagnosticModule,
  DiagnosticReport,
  DiagnosticStatus,
} from "@/utils/diagnostics";
import { formatDiagnosticReport, statusLabel } from "@/utils/diagnostics";
import { parseJsonResponse } from "@/utils/safe-json";
import { cn } from "@/utils/cn";

function StatusIcon({ status }: { status: DiagnosticStatus }) {
  if (status === "ok") {
    return <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />;
  }
  if (status === "warning") {
    return <AlertTriangle className="size-4 shrink-0 text-amber-400" />;
  }
  return <XCircle className="size-4 shrink-0 text-rose-400" />;
}

function StatusBadge({ status }: { status: DiagnosticStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        status === "ok" && "bg-emerald-500/10 text-emerald-400",
        status === "warning" && "bg-amber-500/10 text-amber-400",
        status === "error" && "bg-rose-500/10 text-rose-400"
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

function CheckRow({ check }: { check: DiagnosticCheck }) {
  return (
    <li className="flex items-start gap-2 rounded-md border border-white/[0.04] bg-white/[0.02] px-2.5 py-2">
      <StatusIcon status={check.status} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12px] font-medium text-zinc-200">{check.label}</p>
          <StatusBadge status={check.status} />
          {check.kind === "table" && check.detail && check.status !== "ok" && (
            <span className="text-[10px] text-zinc-600">· {check.detail}</span>
          )}
          {check.kind === "api" && check.status === "error" && (
            <span className="text-[10px] text-rose-400/80">· API falhando</span>
          )}
        </div>
        <p className="mt-0.5 break-words text-[11px] text-zinc-500">{check.message}</p>
        {check.detail && check.kind === "api" && check.status === "error" && (
          <p className="mt-0.5 break-words text-[10px] text-zinc-600">{check.detail}</p>
        )}
      </div>
    </li>
  );
}

function ModuleCard({ module }: { module: DiagnosticModule }) {
  const [open, setOpen] = useState(module.status !== "ok");

  return (
    <Panel
      className={cn(
        module.status === "ok" && "border-emerald-500/10",
        module.status === "warning" && "border-amber-500/15",
        module.status === "error" && "border-rose-500/15"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left"
      >
        <PanelHeader className="items-center pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <StatusIcon status={module.status} />
            <PanelTitle className="truncate">{module.label}</PanelTitle>
          </div>
          <StatusBadge status={module.status} />
        </PanelHeader>
        <PanelContent className="pt-0">
          <p className="text-[11px] text-zinc-500">{module.message}</p>
        </PanelContent>
      </button>
      {open && (
        <PanelContent className="border-t border-white/[0.06] pt-2">
          <ul className="space-y-1.5">
            {module.checks.map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
          </ul>
        </PanelContent>
      )}
    </Panel>
  );
}

export function DiagnosticsView() {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/diagnostics", { method: "POST" });
      const { data, error: parseError } = await parseJsonResponse<{
        report?: DiagnosticReport;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data?.report) {
        toast.error(data?.error ?? parseError ?? "Diagnóstico falhou.");
        return;
      }

      setReport(data.report);
      toast.success("Diagnóstico concluído.");
    } catch {
      toast.error("Erro de conexão ao rodar diagnóstico.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function copyReport() {
    if (!report) {
      toast.error("Execute o diagnóstico antes de copiar.");
      return;
    }
    try {
      await navigator.clipboard.writeText(formatDiagnosticReport(report));
      toast.success("Relatório copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03]">
            <Stethoscope className="size-4 text-teal-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-600">
              Sistema
            </p>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-50 sm:text-[22px]">
              Painel de Diagnóstico
            </h1>
            <p className="mt-0.5 max-w-xl text-[12px] text-zinc-500">
              Verifique Supabase, OpenAI e todos os módulos em uma única execução.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Link
            href="/dashboard/logs"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-orange-500/20 bg-orange-500/10 px-3 text-[11px] font-medium text-orange-300 hover:bg-orange-500/15 sm:min-h-0 sm:py-2"
          >
            <ScrollText className="size-3.5" />
            Central de Logs
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <ActionButton
          icon={loading ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
          className="w-full sm:w-auto"
          disabled={loading}
          onClick={() => void runDiagnostics()}
        >
          {loading ? "Rodando..." : "Rodar diagnóstico"}
        </ActionButton>
        <ActionButton
          icon={<ClipboardCopy className="size-3.5" />}
          variant="ghost"
          className="w-full sm:w-auto"
          disabled={!report}
          onClick={() => void copyReport()}
        >
          Copiar relatório
        </ActionButton>
      </div>

      {!report && !loading && (
        <Panel className="border-dashed border-white/[0.08]">
          <PanelContent className="py-8 text-center">
            <p className="text-[13px] text-zinc-400">
              Nenhum diagnóstico executado ainda.
            </p>
            <p className="mt-1 text-[11px] text-zinc-600">
              Clique em &quot;Rodar diagnóstico&quot; para testar tudo de uma vez.
            </p>
          </PanelContent>
        </Panel>
      )}

      {report && (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Panel className="border-emerald-500/15 bg-emerald-500/[0.03]">
              <PanelContent className="py-3">
                <p className="text-[11px] text-zinc-500">OK</p>
                <p className="text-2xl font-semibold text-emerald-300">{report.summary.ok}</p>
              </PanelContent>
            </Panel>
            <Panel className="border-amber-500/15 bg-amber-500/[0.03]">
              <PanelContent className="py-3">
                <p className="text-[11px] text-zinc-500">Atenção</p>
                <p className="text-2xl font-semibold text-amber-300">{report.summary.warning}</p>
              </PanelContent>
            </Panel>
            <Panel className="border-rose-500/15 bg-rose-500/[0.03]">
              <PanelContent className="py-3">
                <p className="text-[11px] text-zinc-500">Erro</p>
                <p className="text-2xl font-semibold text-rose-300">{report.summary.error}</p>
              </PanelContent>
            </Panel>
          </div>

          <p className="text-[11px] text-zinc-600">
            Executado em {new Date(report.ranAt).toLocaleString("pt-BR")} ·{" "}
            {report.durationMs}ms
          </p>

          {report.sections.map((section) => (
            <Panel key={section.id}>
              <PanelHeader className="items-center">
                <div className="flex items-center gap-2">
                  <StatusIcon status={section.status} />
                  <PanelTitle>{section.title}</PanelTitle>
                </div>
                <StatusBadge status={section.status} />
              </PanelHeader>
              <PanelContent className="space-y-3 pt-0">
                {section.checks.length > 0 && (
                  <ul className="space-y-1.5">
                    {section.checks.map((check) => (
                      <CheckRow key={check.id} check={check} />
                    ))}
                  </ul>
                )}
                {section.modules && section.modules.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                    {section.modules.map((mod) => (
                      <ModuleCard key={mod.id} module={mod} />
                    ))}
                  </div>
                )}
              </PanelContent>
            </Panel>
          ))}
        </>
      )}
    </div>
  );
}
