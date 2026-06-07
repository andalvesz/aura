"use client";

import { Copy, FileText, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import {
  formatReportWithAnalysis,
  type ExecutiveReportAnalysis,
  type ExecutiveReportPayload,
  type ExecutiveReportType,
} from "@/utils/executive-reports";
import { parseJsonResponse } from "@/utils/safe-json";

const TABS: { id: ExecutiveReportType; label: string }[] = [
  { id: "daily", label: "Diário" },
  { id: "weekly", label: "Semanal" },
  { id: "monthly", label: "Mensal" },
];

export function ExecutiveReportsPanel() {
  const [active, setActive] = useState<ExecutiveReportType>("daily");
  const [report, setReport] = useState<ExecutiveReportPayload | null>(null);
  const [analysis, setAnalysis] = useState<ExecutiveReportAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const loadReport = useCallback(async (type: ExecutiveReportType) => {
    setLoading(true);
    setAnalysis(null);
    try {
      const res = await fetch(`/api/executive-reports?type=${type}`);
      const { data, error: parseError } = await parseJsonResponse<{
        report?: ExecutiveReportPayload;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        toast.error(data?.error ?? parseError ?? "Erro ao carregar relatório.");
        setReport(null);
        return;
      }

      setReport(data?.report ?? null);
    } catch {
      toast.error("Falha ao carregar relatório.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport(active);
  }, [active, loadReport]);

  async function handleAnalyze() {
    if (!report) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/executive-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: active }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        analysis?: ExecutiveReportAnalysis;
        fullText?: string;
        warning?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        toast.error(data?.error ?? parseError ?? "Erro na análise.");
        return;
      }

      if (data?.analysis) setAnalysis(data.analysis);
      if (data?.warning) toast.info(data.warning);
      else toast.success("Análise gerada pela Aura Central.");
    } catch {
      toast.error("Falha na análise com IA.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleCopy() {
    if (!report) return;
    const text = analysis
      ? formatReportWithAnalysis(report, analysis)
      : report.text;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Relatório copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <Panel className="border-cyan-500/10 bg-cyan-500/[0.02]">
      <PanelHeader>
        <PanelTitle className="flex items-center gap-2">
          <FileText className="size-3.5 text-cyan-400" />
          Relatórios
        </PanelTitle>
      </PanelHeader>
      <PanelContent className="space-y-3 pt-0">
        <div className="flex flex-wrap gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`rounded-md px-2.5 py-1.5 text-[11px] transition-colors ${
                active === tab.id
                  ? "bg-cyan-500/20 text-cyan-200"
                  : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-[12px] text-zinc-500">
            <Loader2 className="size-3.5 animate-spin" />
            Gerando relatório...
          </div>
        ) : !report ? (
          <p className="py-4 text-center text-[12px] text-zinc-500">
            Não foi possível carregar o relatório.
          </p>
        ) : (
          <>
            <pre className="max-h-[min(40vh,320px)] overflow-x-auto overflow-y-auto break-words whitespace-pre-wrap rounded-md border border-white/[0.06] bg-zinc-950/50 p-3 font-sans text-[12px] leading-relaxed text-zinc-300">
              {report.text}
            </pre>

            {analysis && (
              <div className="space-y-2 rounded-md border border-cyan-500/15 bg-cyan-500/5 p-3 text-[12px] text-zinc-300">
                <p className="text-[10px] font-medium uppercase tracking-wide text-cyan-400/90">
                  Análise Aura Central
                </p>
                <p>
                  <span className="text-zinc-500">O que funcionou:</span> {analysis.funcionou}
                </p>
                <p>
                  <span className="text-zinc-500">O que não funcionou:</span>{" "}
                  {analysis.naoFuncionou}
                </p>
                <p>
                  <span className="text-zinc-500">Maior oportunidade:</span>{" "}
                  {analysis.maiorOportunidade}
                </p>
                <p>
                  <span className="text-zinc-500">Maior risco:</span> {analysis.maiorRisco}
                </p>
                <p>
                  <span className="text-zinc-500">Próxima prioridade:</span>{" "}
                  {analysis.proximaPrioridade}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-white/[0.08] px-3 text-[11px] text-zinc-300 hover:bg-white/[0.04]"
              >
                <Copy className="size-3.5" />
                Copiar relatório
              </button>
              <button
                type="button"
                disabled={analyzing}
                onClick={handleAnalyze}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-cyan-500/25 bg-cyan-500/10 px-3 text-[11px] text-cyan-200 hover:bg-cyan-500/15 disabled:opacity-50"
              >
                {analyzing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                Análise IA
              </button>
            </div>

            <p
              className="text-[10px] text-zinc-600"
              title={JSON.stringify(report.pdfMeta)}
            >
              Exportação PDF — em breve ({report.pdfMeta.templateId} v
              {report.pdfMeta.version})
            </p>
          </>
        )}
      </PanelContent>
    </Panel>
  );
}
