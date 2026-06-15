"use client";

import {
  Crown,
  Loader2,
  Radar,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { AvailableBudgetField } from "@/components/dashboard/available-budget-field";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useCeo } from "@/hooks/use-ceo";
import type { AuraCeoSession } from "@/types/database";
import {
  CEO_EXAMPLE_QUESTIONS,
  parseCronograma,
  parseJsonStringArray,
  parseMissoesRecomendadas,
  type CeoOpportunityItem,
  type CeoOpportunityRadar,
} from "@/utils/ceo";
import { formatBRL } from "@/utils/format";

function RadarItem({ label, item }: { label: string; item: CeoOpportunityItem }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium text-violet-300">{label}</p>
        <span className="shrink-0 rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-200">
          {item.score}
        </span>
      </div>
      <p className="mt-1 text-[11px] font-medium text-zinc-200">{item.titulo}</p>
      <p className="mt-0.5 line-clamp-2 text-[10px] text-zinc-500">{item.descricao}</p>
      {item.modulo && (
        <p className="mt-1 text-[9px] uppercase tracking-wide text-zinc-600">{item.modulo}</p>
      )}
    </div>
  );
}

function OpportunityRadarPanel({ radar }: { radar: CeoOpportunityRadar }) {
  return (
    <Panel className="border-violet-500/15">
      <PanelHeader>
        <PanelTitle className="flex items-center gap-1.5">
          <Radar className="size-3.5 text-violet-400" />
          Opportunity Radar
          <span className="ml-auto rounded-md bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-200">
            Score IA {radar.scoreIa}/100
          </span>
        </PanelTitle>
      </PanelHeader>
      <PanelContent>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <RadarItem label="Melhor oportunidade" item={radar.melhorOportunidade} />
          <RadarItem label="Mais lucrativo" item={radar.maisLucrativo} />
          <RadarItem label="Mais rápido" item={radar.maisRapido} />
          <RadarItem label="Mais alinhado ao legado" item={radar.maisAlinhadoLegado} />
          <RadarItem label="Mais escalável" item={radar.maisEscalavel} />
        </div>
      </PanelContent>
    </Panel>
  );
}

function SessionDisplay({ session }: { session: AuraCeoSession }) {
  const prioridades = parseJsonStringArray(session.prioridades);
  const riscos = parseJsonStringArray(session.riscos);
  const oportunidades = parseJsonStringArray(session.oportunidades);
  const cronograma = parseCronograma(session.cronograma);
  const missoes = parseMissoesRecomendadas(session.missoes_recomendadas);

  return (
    <div className="space-y-3 text-[12px]">
      {session.resumo_executivo && (
        <div className="rounded-md border border-violet-500/15 bg-violet-500/[0.04] p-3">
          <p className="mb-1 text-[10px] font-medium text-violet-300">Resumo executivo</p>
          <p className="whitespace-pre-wrap text-[11px] text-zinc-300">{session.resumo_executivo}</p>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {session.probabilidade_sucesso != null && (
          <div className="rounded-md border border-white/[0.06] p-2">
            <p className="text-[10px] text-zinc-500">Probabilidade de sucesso</p>
            <p className="font-medium text-emerald-300">{session.probabilidade_sucesso}%</p>
          </div>
        )}
        {session.score_ia != null && (
          <div className="rounded-md border border-white/[0.06] p-2">
            <p className="text-[10px] text-zinc-500">Score IA</p>
            <p className="font-medium text-violet-300">{session.score_ia}/100</p>
          </div>
        )}
      </div>

      {prioridades.length > 0 && (
        <div className="rounded-md border border-violet-500/15 bg-violet-500/[0.04] p-3">
          <p className="mb-1 text-[10px] font-medium text-violet-300">Prioridades</p>
          <ol className="list-inside list-decimal space-y-0.5 text-[11px] text-zinc-300">
            {prioridades.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </div>
      )}

      {session.plano_acao && (
        <div>
          <p className="mb-1 text-[10px] font-medium text-zinc-500">Plano de ação</p>
          <p className="whitespace-pre-wrap text-[11px] text-zinc-400">{session.plano_acao}</p>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {riscos.length > 0 && (
          <div className="rounded-md border border-rose-500/15 bg-rose-500/[0.04] p-3">
            <p className="mb-1 text-[10px] font-medium text-rose-300">Riscos</p>
            <ul className="list-inside list-disc space-y-0.5 text-[10px] text-zinc-400">
              {riscos.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {oportunidades.length > 0 && (
          <div className="rounded-md border border-emerald-500/15 bg-emerald-500/[0.04] p-3">
            <p className="mb-1 text-[10px] font-medium text-emerald-300">Oportunidades</p>
            <ul className="list-inside list-disc space-y-0.5 text-[10px] text-zinc-400">
              {oportunidades.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {cronograma.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-zinc-500">Cronograma</p>
          {cronograma.map((w) => (
            <div
              key={w.semana}
              className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5"
            >
              <p className="text-[11px] font-medium text-zinc-200">
                Semana {w.semana} — {w.foco}
              </p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-[10px] text-zinc-400">
                {w.tarefas.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {missoes.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-medium text-zinc-500">Missões recomendadas</p>
          <ul className="space-y-1.5">
            {missoes.map((m) => (
              <li
                key={m.titulo}
                className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2"
              >
                <p className="text-[11px] font-medium text-zinc-300">{m.titulo}</p>
                {m.descricao && (
                  <p className="text-[10px] text-zinc-500">{m.descricao}</p>
                )}
                {m.modulo && (
                  <p className="mt-0.5 text-[9px] uppercase text-zinc-600">{m.modulo}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function CeoView() {
  const {
    dashboard,
    session,
    radar,
    loading,
    backgroundLoading,
    error,
    busy,
    refresh,
    createPlan,
    removeSession,
  } = useCeo();
  const [pergunta, setPergunta] = useState("");

  async function handleCreatePlan(text?: string) {
    const q = (text ?? pergunta).trim();
    if (!q) {
      toast.error("Digite sua pergunta estratégica.");
      return;
    }

    const { session: newSession, error: planError } = await createPlan(q);
    if (planError || !newSession) {
      toast.error(planError ?? "Erro ao gerar plano.");
      return;
    }

    setPergunta("");
    toast.success("Plano estratégico gerado com IA!");
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton />
        <ListSkeleton rows={3} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {(error || backgroundLoading) && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/90">
          {error ?? "Alguns dados ainda estão carregando em segundo plano."}
          {error && (
            <button
              type="button"
              onClick={() => void refresh()}
              className="ml-2 underline hover:text-amber-100"
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}
      {dashboard && (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Meta financeira ativa"
            value={dashboard.metaFinanceiraAtiva}
            hint="Money Missions"
          />
          <MetricCard
            label="Projeto principal"
            value={dashboard.projetoPrincipal}
            hint="Creator pipeline"
          />
          <MetricCard
            label="Missão do dia"
            value={dashboard.missaoDoDia}
            hint="Prioridade imediata"
          />
          <MetricCard
            label="XP atual"
            value={`${dashboard.xpAtual} XP`}
            hint={`Nível ${dashboard.xpNivel}`}
          />
          <MetricCard
            label="Valor conquistado"
            value={formatBRL(dashboard.valorConquistado)}
            hint="Progresso financeiro"
          />
          <MetricCard
            label="Próximo marco"
            value={dashboard.proximoMarco}
            hint="Metas ou calendário"
          />
        </div>
      )}

      {radar && <OpportunityRadarPanel radar={radar} />}

      <Panel className="border-violet-500/15">
        <PanelHeader>
          <PanelTitle>Orçamento para campanhas</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <AvailableBudgetField scope="money" persistOnBlur />
        </PanelContent>
      </Panel>

      <Panel className="border-violet-500/15">
        <PanelHeader>
          <PanelTitle className="flex items-center gap-1.5">
            <Crown className="size-3.5 text-violet-400" />
            Pergunta estratégica
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {CEO_EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={busy}
                onClick={() => {
                  setPergunta(q);
                  void handleCreatePlan(q);
                }}
                className="rounded-md border border-white/[0.06] px-2.5 py-1 text-[10px] text-zinc-400 transition-colors hover:border-violet-500/20 hover:text-violet-300 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreatePlan();
            }}
            className="flex gap-2"
          >
            <input
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder="Como ganho R$ 20.000? O que devo priorizar?"
              disabled={busy}
              className="flex-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[12px] text-zinc-200 placeholder:text-zinc-600 disabled:opacity-50"
            />
            <ActionButton
              disabled={busy || !pergunta.trim()}
              className="shrink-0"
              onClick={() => void handleCreatePlan()}
            >
              {busy ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  Gerar estratégia
                </>
              )}
            </ActionButton>
          </form>

          <p className="text-[10px] text-zinc-600">
            A IA analisa Legado, Money, Creator, Research, CopyLab, Launch, Financeiro, Metas,
            Social, Alvesz, Idiomas, Viagens, Saúde e Calendário.
          </p>
        </PanelContent>
      </Panel>

      {session && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-200">
              <TrendingUp className="size-3.5 text-violet-400" />
              {session.pergunta}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void removeSession(session.id).then(({ error: delError }) => {
                  if (delError) toast.error(delError);
                  else toast.success("Sessão removida.");
                });
              }}
              className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-rose-400 disabled:opacity-50"
            >
              <Trash2 className="size-3" />
              Excluir
            </button>
          </div>

          <Panel className="border-violet-500/15">
            <PanelHeader>
              <PanelTitle>Plano gerado pela Aura CEO</PanelTitle>
            </PanelHeader>
            <PanelContent>
              <SessionDisplay session={session} />
            </PanelContent>
          </Panel>
        </>
      )}
    </div>
  );
}
