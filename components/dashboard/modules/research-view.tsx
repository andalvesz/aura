"use client";

import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Search,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useResearch } from "@/hooks/use-research";
import type { CreatorResearch } from "@/types/database";
import { CREATOR_NICHE_SUGGESTIONS } from "@/utils/creator";
import {
  formatBRL,
  parseJsonStringArray,
  RESEARCH_IA_ACTIONS,
  type ResearchIntake,
} from "@/utils/research";
import { parseJsonResponse } from "@/utils/safe-json";
import { cn } from "@/utils/cn";

const EMPTY_INTAKE: ResearchIntake = {
  ideia: "",
  nicho: "",
  publico: "",
};

function ScoreBar({ label, value }: { label: string; value: number | null | undefined }) {
  const v = value ?? 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-zinc-400">{label}</span>
        <span className="font-medium text-zinc-200">{value ?? "—"}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-blue-400 transition-all"
          style={{ width: `${Math.min(100, Math.max(0, v))}%` }}
        />
      </div>
    </div>
  );
}

function ResearchDetail({
  record,
  onConvert,
  onDelete,
  busy,
}: {
  record: CreatorResearch;
  onConvert: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const dores = parseJsonStringArray(record.dores);
  const desejos = parseJsonStringArray(record.desejos);
  const objecoes = parseJsonStringArray(record.objecoes);
  const concorrentes = parseJsonStringArray(record.produtos_concorrentes);
  const nota = record.nota_final ?? 0;
  const verdict =
    nota >= 70 ? "Oportunidade promissora" : nota >= 50 ? "Validar mais" : "Alto risco";

  return (
    <div className="space-y-3 text-[12px]">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-[11px] font-medium",
            nota >= 70
              ? "bg-emerald-500/15 text-emerald-300"
              : nota >= 50
                ? "bg-amber-500/15 text-amber-300"
                : "bg-rose-500/15 text-rose-300"
          )}
        >
          {verdict} · {nota}/100
        </span>
        {record.product_id && (
          <Link
            href="/dashboard/creator"
            className="text-[10px] text-violet-400 hover:underline"
          >
            Produto criado →
          </Link>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Nicho</p>
          <p className="text-zinc-300">{record.nicho ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Público</p>
          <p className="text-zinc-300">{record.publico ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Problema</p>
          <p className="text-zinc-300">{record.problema ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Solução</p>
          <p className="text-zinc-300">{record.solucao ?? "—"}</p>
        </div>
      </div>

      {record.concorrencia_analise && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Concorrência</p>
          <p className="text-zinc-400">{record.concorrencia_analise}</p>
        </div>
      )}

      <div className="space-y-2 rounded-md border border-blue-500/15 bg-blue-500/[0.04] p-3">
        <p className="text-[11px] font-medium text-blue-300">Scores de mercado</p>
        <ScoreBar label="Demanda" value={record.demanda} />
        <ScoreBar label="Competição" value={record.competicao} />
        <ScoreBar label="Escalabilidade" value={record.escalabilidade} />
        <ScoreBar label="Potencial de lucro" value={record.potencial_lucro} />
        <ScoreBar label="Compatibilidade Anderson" value={record.compatibilidade_perfil} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1 rounded-md border border-white/[0.06] p-2.5">
          <p className="text-[10px] font-medium text-zinc-500">Facilidade criação / venda</p>
          <p className="text-[11px] text-zinc-400">
            Criação: {record.facilidade_criacao ?? "—"}/100 · Venda:{" "}
            {record.facilidade_venda ?? "—"}/100
          </p>
        </div>
        <div className="space-y-1 rounded-md border border-white/[0.06] p-2.5">
          <p className="text-[10px] font-medium text-zinc-500">Faixa de preço</p>
          <p className="text-[11px] text-zinc-300">
            {formatBRL(record.faixa_preco_min)} – {formatBRL(record.faixa_preco_max)}
          </p>
        </div>
      </div>

      {record.avatar && (
        <div className="rounded-md border border-violet-500/10 bg-violet-500/[0.03] p-2.5">
          <p className="mb-1 flex items-center gap-1 text-[10px] font-medium text-violet-400">
            <Users className="size-3" />
            Avatar
          </p>
          <p className="text-[11px] text-zinc-300">{record.avatar}</p>
        </div>
      )}

      {record.diferencial_sugerido && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-600">Diferencial sugerido</p>
          <p className="text-zinc-300">{record.diferencial_sugerido}</p>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          ["Dores", dores],
          ["Desejos", desejos],
          ["Objeções", objecoes],
        ].map(([label, items]) => (
          <div key={label as string} className="rounded-md border border-white/[0.06] p-2">
            <p className="mb-1 text-[10px] font-medium text-zinc-500">{label as string}</p>
            <ul className="list-inside list-disc space-y-0.5 text-[10px] text-zinc-400">
              {(items as string[]).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {concorrentes.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-600">
            Produtos concorrentes
          </p>
          <ul className="list-inside list-disc space-y-0.5 text-[11px] text-zinc-400">
            {concorrentes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {!record.product_id && (
          <ActionButton
            disabled={busy}
            icon={
              busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ArrowRight className="size-3.5" />
              )
            }
            onClick={onConvert}
          >
            Criar produto no Creator
          </ActionButton>
        )}
        <ActionButton
          variant="ghost"
          disabled={busy}
          icon={<Trash2 className="size-3.5" />}
          onClick={onDelete}
        >
          Excluir
        </ActionButton>
      </div>
    </div>
  );
}

export function ResearchView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dashboard, records, loading, error, busy, refresh, analyze, convertToProduct, removeRecord } =
    useResearch();

  const [intake, setIntake] = useState<ResearchIntake>(EMPTY_INTAKE);
  const [activeRecord, setActiveRecord] = useState<CreatorResearch | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [iaInput, setIaInput] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaMessages, setIaMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text: "Sou a Aura Market Research — valido oportunidades antes da criação do produto.",
    },
  ]);

  useEffect(() => {
    const ideia = searchParams.get("ideia");
    const nicho = searchParams.get("nicho");
    const publico = searchParams.get("publico");
    if (ideia || nicho || publico) {
      setIntake({
        ideia: ideia ?? "",
        nicho: nicho ?? "",
        publico: publico ?? "",
      });
      setShowForm(true);
    }
  }, [searchParams]);

  async function handleAnalyze() {
    const { record, error: analyzeError } = await analyze(intake);
    if (analyzeError || !record) {
      toast.error(analyzeError ?? "Erro na análise.");
      return;
    }
    setActiveRecord(record);
    setShowForm(false);
    toast.success(`Análise concluída · ${record.nota_final}/100`);
  }

  async function handleConvert(researchId: string) {
    const { bundle, error: convertError } = await convertToProduct(researchId);
    if (convertError || !bundle) {
      toast.error(convertError ?? "Erro ao criar produto.");
      return;
    }
    toast.success("Produto criado no Creator!");
    router.push("/dashboard/creator");
  }

  async function sendIaMessage(text: string, actionId?: string) {
    const trimmed = text.trim();
    if (!trimmed || iaLoading) return;

    setIaInput("");
    setIaLoading(true);
    const history = iaMessages.map((m) => ({ role: m.role, content: m.text }));
    setIaMessages((c) => [...c, { role: "user", text: trimmed }]);

    try {
      const res = await fetch("/api/creator-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
          module: "research",
          ...(actionId ? { actionId } : {}),
        }),
      });
      const { data: body, error: parseError } = await parseJsonResponse<{
        text?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok || body?.error) {
        setIaMessages((c) => [
          ...c,
          { role: "assistant", text: body?.error ?? parseError ?? "Erro na IA." },
        ]);
        return;
      }

      setIaMessages((c) => [
        ...c,
        { role: "assistant", text: body?.text ?? "Sem resposta." },
      ]);
    } catch {
      setIaMessages((c) => [
        ...c,
        { role: "assistant", text: "Erro de conexão." },
      ]);
    } finally {
      setIaLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton />
        <ListSkeleton rows={3} />
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <Panel className="border-rose-500/15 bg-rose-500/[0.03]">
        <PanelContent className="py-4 text-center text-[12px] text-rose-300">
          {error}
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-2 block w-full text-[11px] text-rose-200 underline"
          >
            Tentar novamente
          </button>
        </PanelContent>
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Análises realizadas"
          value={String(dashboard?.totalAnalises ?? 0)}
          hint="Total de pesquisas"
        />
        <MetricCard
          label="Nota média"
          value={String(dashboard?.notaMedia ?? 0)}
          hint="Score 0–100"
        />
        <MetricCard
          label="Melhor oportunidade"
          value={dashboard?.melhorOportunidade ?? "—"}
          hint="Maior nota de mercado"
        />
        <MetricCard
          label="Convertidos"
          value={String(dashboard?.convertidos ?? 0)}
          hint="Viraram produto no Creator"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton
          icon={<Search className="size-3.5" />}
          onClick={() => {
            setShowForm(true);
            setIntake(EMPTY_INTAKE);
            setActiveRecord(null);
          }}
        >
          Nova análise
        </ActionButton>
        {showForm && (
          <ActionButton variant="ghost" onClick={() => setShowForm(false)}>
            Fechar formulário
          </ActionButton>
        )}
      </div>

      {showForm && (
        <Panel className="border-blue-500/15">
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Search className="size-3.5 text-blue-400" />
              Validar oportunidade
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-3 pt-0">
            <p className="text-[11px] text-zinc-500">
              A IA analisa nicho, público, concorrência e gera avatar, dores, scores e faixa de
              preço antes de criar o produto.
            </p>
            <label className="block">
              <span className="mb-1 block text-[10px] text-zinc-500">Ideia / hipótese</span>
              <textarea
                value={intake.ideia}
                onChange={(e) => setIntake((c) => ({ ...c, ideia: e.target.value }))}
                rows={3}
                placeholder="Ex: curso online de ginástica artística para adultos iniciantes..."
                className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-blue-500/40"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] text-zinc-500">Nicho</span>
                <input
                  value={intake.nicho}
                  onChange={(e) => setIntake((c) => ({ ...c, nicho: e.target.value }))}
                  className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-blue-500/40"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] text-zinc-500">Público-alvo</span>
                <input
                  value={intake.publico}
                  onChange={(e) => setIntake((c) => ({ ...c, publico: e.target.value }))}
                  className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-blue-500/40"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CREATOR_NICHE_SUGGESTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setIntake((c) => ({ ...c, nicho: n }))}
                  className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-400 hover:border-blue-500/30 hover:text-blue-300"
                >
                  {n}
                </button>
              ))}
            </div>
            <ActionButton
              disabled={busy || (!intake.ideia.trim() && !intake.nicho.trim())}
              icon={
                busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )
              }
              onClick={() => void handleAnalyze()}
            >
              Analisar com IA
            </ActionButton>
          </PanelContent>
        </Panel>
      )}

      {activeRecord && (
        <Panel className="border-blue-500/20 bg-blue-500/[0.02]">
          <PanelHeader>
            <PanelTitle>
              {activeRecord.nicho ?? activeRecord.ideia_input?.slice(0, 50) ?? "Análise"}
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            <ResearchDetail
              record={activeRecord}
              busy={busy}
              onConvert={() => void handleConvert(activeRecord.id)}
              onDelete={() =>
                void removeRecord(activeRecord.id).then((r) => {
                  if (r.error) toast.error(r.error);
                  else {
                    setActiveRecord(null);
                    toast.success("Análise removida.");
                  }
                })
              }
            />
          </PanelContent>
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle>Histórico de pesquisas</PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          {records.length === 0 ? (
            <EmptyState
              title="Nenhuma pesquisa ainda"
              description='Clique em "Nova análise" para validar uma oportunidade.'
            />
          ) : (
            records.map((record) => (
              <div
                key={record.id}
                className="rounded-md border border-white/[0.06] bg-white/[0.02]"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId((id) => (id === record.id ? null : record.id))
                  }
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-zinc-200">
                      {record.nicho ?? record.ideia_input?.slice(0, 60) ?? "Sem título"}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      Nota {record.nota_final ?? "—"}/100
                      {record.product_id ? " · convertido" : ""}
                    </p>
                  </div>
                  <TrendingUp
                    className={cn(
                      "size-3.5 shrink-0",
                      (record.nota_final ?? 0) >= 70 ? "text-emerald-400" : "text-zinc-600"
                    )}
                  />
                </button>
                {expandedId === record.id && (
                  <div className="border-t border-white/[0.06] px-3 py-2">
                    <ResearchDetail
                      record={record}
                      busy={busy}
                      onConvert={() => void handleConvert(record.id)}
                      onDelete={() =>
                        void removeRecord(record.id).then((r) => {
                          if (r.error) toast.error(r.error);
                          else toast.success("Análise removida.");
                        })
                      }
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </PanelContent>
      </Panel>

      <Panel className="border-blue-500/10">
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-blue-400" />
            Market Research · IA
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-2 pt-0">
          <div className="flex flex-wrap gap-1.5">
            {RESEARCH_IA_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => void sendIaMessage(action.prompt, action.id)}
                disabled={iaLoading}
                className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] text-zinc-400 hover:border-blue-500/30 hover:text-blue-300 disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-white/[0.04] bg-black/20 p-2">
            {iaMessages.map((m, i) => (
              <p
                key={i}
                className={cn(
                  "whitespace-pre-wrap text-[11px]",
                  m.role === "user" ? "text-blue-200" : "text-zinc-400"
                )}
              >
                {m.text}
              </p>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void sendIaMessage(iaInput);
            }}
          >
            <input
              value={iaInput}
              onChange={(e) => setIaInput(e.target.value)}
              placeholder="Analise essa ideia... Esse nicho vale a pena?"
              className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-blue-500/40"
            />
            <ActionButton
              type="submit"
              disabled={iaLoading || !iaInput.trim()}
              icon={
                iaLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )
              }
            >
              Enviar
            </ActionButton>
          </form>
        </PanelContent>
      </Panel>
    </div>
  );
}
