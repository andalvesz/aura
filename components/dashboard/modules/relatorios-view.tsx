"use client";

import { Copy, FileText, Loader2, Save, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import {
  formatReportWithAnalysis,
  getWeekRange,
  type ExecutiveReportAnalysis,
  type ExecutiveReportPayload,
} from "@/utils/executive-reports";
import { formatDate } from "@/utils/format";
import { parseJsonResponse } from "@/utils/safe-json";

export function RelatoriosView() {
  const [report, setReport] = useState<ExecutiveReportPayload | null>(null);
  const [analysis, setAnalysis] = useState<ExecutiveReportAnalysis | null>(null);
  const [fullText, setFullText] = useState<string | null>(null);
  const [hasData, setHasData] = useState<boolean | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const { start, end } = getWeekRange();

  async function handleGenerate() {
    setGenerating(true);
    setReport(null);
    setAnalysis(null);
    setFullText(null);
    setHasData(null);

    try {
      const res = await fetch("/api/executive-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "weekly" }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        report?: ExecutiveReportPayload;
        analysis?: ExecutiveReportAnalysis;
        fullText?: string;
        hasData?: boolean;
        warning?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        toast.error(data?.error ?? parseError ?? "Erro ao gerar relatório.");
        return;
      }

      setReport(data?.report ?? null);
      setAnalysis(data?.analysis ?? null);
      setFullText(data?.fullText ?? null);
      setHasData(data?.hasData ?? true);

      if (data?.warning) toast.info(data.warning);
      else toast.success("Relatório semanal gerado com análise da Aura.");
    } catch {
      toast.error("Falha ao gerar relatório.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!report) return;
    const text =
      fullText ?? (analysis ? formatReportWithAnalysis(report, analysis) : report.text);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Relatório copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  async function handleSave() {
    if (!report) return;
    const text =
      fullText ?? (analysis ? formatReportWithAnalysis(report, analysis) : report.text);
    setSaving(true);
    try {
      const res = await fetch("/api/executive-reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullText: text, reportType: "weekly" }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        ok?: boolean;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        toast.error(data?.error ?? parseError ?? "Erro ao salvar na memória.");
        return;
      }

      toast.success("Relatório salvo na memória da Aura.");
    } catch {
      toast.error("Falha ao salvar relatório.");
    } finally {
      setSaving(false);
    }
  }

  const showEmptyWeek = report && hasData === false;

  return (
    <div className="space-y-3">
      <Panel className="border-cyan-500/10 bg-cyan-500/[0.02]">
        <PanelHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <PanelTitle className="flex items-center gap-2">
              <FileText className="size-4 text-cyan-400" />
              Relatório Semanal
            </PanelTitle>
            <p className="text-[11px] text-zinc-500">
              {formatDate(start)} – {formatDate(end)}
            </p>
          </div>
        </PanelHeader>
        <PanelContent className="space-y-4 pt-0">
          <p className="text-[12px] text-zinc-500">
            Resumo inteligente com dados reais de Financeiro, CRM, Calendário, Alvesz, Saúde,
            Social Media e Memória da Aura.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={generating}
              onClick={handleGenerate}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-cyan-500/25 bg-cyan-500/10 px-3 text-[11px] text-cyan-200 hover:bg-cyan-500/15 disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              Gerar relatório da semana
            </button>

            {report && (
              <>
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
                  disabled={saving}
                  onClick={handleSave}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-violet-500/25 bg-violet-500/10 px-3 text-[11px] text-violet-200 hover:bg-violet-500/15 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  Salvar relatório na memória
                </button>
              </>
            )}
          </div>

          {generating && (
            <div className="flex items-center gap-2 py-8 text-[12px] text-zinc-500">
              <Loader2 className="size-3.5 animate-spin" />
              Coletando dados e gerando análise com IA...
            </div>
          )}

          {!generating && !report && (
            <EmptyState
              title="Nenhum relatório gerado"
              description="Clique em Gerar relatório da semana para montar o resumo com dados reais dos seus módulos."
              action={
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-cyan-500/25 bg-cyan-500/10 px-3 text-[11px] text-cyan-200 hover:bg-cyan-500/15"
                >
                  <Sparkles className="size-3.5" />
                  Gerar relatório da semana
                </button>
              }
            />
          )}

          {!generating && showEmptyWeek && (
            <EmptyState
              title="Semana sem atividade registrada"
              description="Não há receitas, despesas, leads, eventos, conteúdos, treinos, hábitos ou memórias nesta semana. Cadastre dados nos módulos e gere novamente."
            />
          )}

          {!generating && report && !showEmptyWeek && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {report.sections
                  .filter((s) => !s.label.startsWith("Resumo"))
                  .map((section) => (
                    <div
                      key={section.label}
                      className="rounded-md border border-white/[0.06] bg-zinc-950/40 p-3"
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                        {section.label}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {section.lines.map((line) => (
                          <li key={line} className="text-[12px] text-zinc-300">
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>

              {analysis && (
                <div className="space-y-3 rounded-md border border-cyan-500/15 bg-cyan-500/5 p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-cyan-400/90">
                    Análise da Aura
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <AnalysisItem label="O que funcionou" value={analysis.funcionou} />
                    <AnalysisItem label="O que não funcionou" value={analysis.naoFuncionou} />
                    <AnalysisItem label="Maior oportunidade" value={analysis.maiorOportunidade} />
                    <AnalysisItem label="Maior risco" value={analysis.maiorRisco} />
                  </div>
                  <AnalysisItem
                    label="Prioridade da próxima semana"
                    value={analysis.proximaPrioridade}
                    highlight
                  />
                </div>
              )}
            </div>
          )}
        </PanelContent>
      </Panel>
    </div>
  );
}

function AnalysisItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? "sm:col-span-2" : undefined}>
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-300">{value}</p>
    </div>
  );
}
