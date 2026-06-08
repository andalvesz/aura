"use client";

import {
  Award,
  BookOpen,
  Calendar,
  Flag,
  Loader2,
  Medal,
  Send,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton, MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { useLegacy } from "@/hooks/use-legacy";
import type { LegacyCategoria } from "@/types/database";
import {
  buildTimelineYears,
  computeLegacyMetrics,
  filterHallOfFame,
  getLegacyCategoryLabel,
  getLegacyYearOptions,
  isLegacyEmpty,
  LEGACY_CATEGORIAS,
  LEGACY_IA_ACTIONS,
  LEGACY_START_YEAR,
} from "@/utils/legado";
import { parseJsonResponse } from "@/utils/safe-json";

const ACHIEVEMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  medalha: Medal,
  trofeu: Trophy,
  vaga: Flag,
  conquista_pessoal: Award,
  outro: Sparkles,
};

const MILESTONE_STATUS_STYLES = {
  concluido: "text-emerald-300",
  em_andamento: "text-amber-300",
  futuro: "text-sky-300",
};

export function LegadoView() {
  const { data, loading, error, seeding, seedInitial, refresh } = useLegacy();
  const [filterAno, setFilterAno] = useState<number | "all">("all");
  const [filterCategoria, setFilterCategoria] = useState<LegacyCategoria | "all">("all");
  const [iaInput, setIaInput] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaMessages, setIaMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    {
      role: "assistant",
      text: "Sou a Aura Legado — conheço sua trajetória desde 2016. Pergunte sobre conquistas, evolução ou padrões da sua história.",
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [autoSeeded, setAutoSeeded] = useState(false);

  const metrics = useMemo(() => computeLegacyMetrics(data), [data]);
  const timelineYears = useMemo(() => buildTimelineYears(data.timeline), [data.timeline]);
  const yearOptions = useMemo(() => getLegacyYearOptions(data), [data]);

  const hallItems = useMemo(() => {
    const achievements = filterHallOfFame(data.achievements, {
      ano: filterAno,
      categoria: filterCategoria,
    });
    const certificates = filterHallOfFame(data.certificates, {
      ano: filterAno,
      categoria: filterCategoria,
    });
    return { achievements, certificates };
  }, [data, filterAno, filterCategoria]);

  useEffect(() => {
    if (!loading && !autoSeeded && isLegacyEmpty(data)) {
      setAutoSeeded(true);
      void seedInitial().then((res) => {
        if (!res.error && res.seeded) {
          toast.success("Trajetória de Anderson Alves importada.");
        }
      });
    }
  }, [loading, data, autoSeeded, seedInitial]);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }

  async function sendIaMessage(text: string, actionId?: string) {
    const trimmed = text.trim();
    if (!trimmed || iaLoading) return;

    setIaInput("");
    setIaLoading(true);
    const history = iaMessages.map((m) => ({ role: m.role, content: m.text }));
    setIaMessages((c) => [...c, { role: "user", text: trimmed }]);
    scrollToBottom();

    try {
      const res = await fetch("/api/legado-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history,
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
          { role: "assistant", text: body?.error ?? parseError ?? "Erro na IA Legado." },
        ]);
        return;
      }

      setIaMessages((c) => [
        ...c,
        { role: "assistant", text: body?.text ?? "Não consegui responder." },
      ]);
    } catch {
      setIaMessages((c) => [
        ...c,
        { role: "assistant", text: "Erro de conexão com a IA Legado." },
      ]);
    } finally {
      setIaLoading(false);
      scrollToBottom();
    }
  }

  if (loading || seeding) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  if (error && isLegacyEmpty(data)) {
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
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Anos de trajetória" value={String(metrics.anosTrajetoria)} hint={`Desde ${LEGACY_START_YEAR}`} />
        <MetricCard label="Conquistas" value={String(metrics.conquistasRegistradas)} hint="Hall da Fama" />
        <MetricCard label="Medalhas" value={String(metrics.medalhas)} hint="Medalhas e troféus" />
        <MetricCard label="Certificados" value={String(metrics.certificados)} hint="Formações e cursos" />
        <MetricCard label="Viagens" value={String(metrics.viagens)} hint="Eventos e marcos" />
        <MetricCard label="Marcos de vida" value={String(metrics.marcosVida)} hint="Momentos decisivos" />
      </div>

      <Panel className="border-amber-500/10 bg-amber-500/[0.02]">
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Calendar className="size-3.5 text-amber-400" />
            Timeline · {LEGACY_START_YEAR} → hoje
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="max-h-[320px] space-y-3 overflow-y-auto pt-0">
          {timelineYears.every((y) => y.items.length === 0) ? (
            <EmptyState
              title="Timeline vazia"
              description="Importe a trajetória inicial ou cadastre eventos."
              action={
                <button
                  type="button"
                  onClick={() => void seedInitial()}
                  className="text-[11px] text-amber-300 underline"
                >
                  Importar trajetória Anderson Alves
                </button>
              }
            />
          ) : (
            timelineYears.map(({ year, items }) =>
              items.length > 0 ? (
                <div key={year}>
                  <p className="mb-1.5 text-[12px] font-semibold text-amber-200">{year}</p>
                  <ul className="space-y-1 border-l border-amber-500/20 pl-3">
                    {items.map((item) => (
                      <li key={item.id} className="text-[11px] text-zinc-400">
                        <span className="font-medium text-zinc-200">{item.titulo}</span>
                        <span className="ml-1.5 rounded bg-white/[0.04] px-1 py-0.5 text-[9px] text-zinc-500">
                          {getLegacyCategoryLabel(item.categoria)}
                        </span>
                        {item.descricao && (
                          <p className="mt-0.5 text-[10px] text-zinc-500">{item.descricao}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null
            )
          )}
        </PanelContent>
      </Panel>

      <Panel className="border-yellow-500/10 bg-yellow-500/[0.02]">
        <PanelHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <PanelTitle className="flex items-center gap-2">
            <Trophy className="size-3.5 text-yellow-400" />
            Hall da Fama
          </PanelTitle>
          <div className="flex flex-wrap gap-2">
            <select
              value={filterAno === "all" ? "all" : String(filterAno)}
              onChange={(e) =>
                setFilterAno(e.target.value === "all" ? "all" : Number(e.target.value))
              }
              className="h-8 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[11px] text-zinc-300"
            >
              <option value="all" className="bg-zinc-900">Todos os anos</option>
              {yearOptions.map((y) => (
                <option key={y} value={y} className="bg-zinc-900">{y}</option>
              ))}
            </select>
            <select
              value={filterCategoria}
              onChange={(e) =>
                setFilterCategoria(e.target.value as LegacyCategoria | "all")
              }
              className="h-8 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[11px] text-zinc-300"
            >
              <option value="all" className="bg-zinc-900">Todas categorias</option>
              {LEGACY_CATEGORIAS.map((c) => (
                <option key={c.id} value={c.id} className="bg-zinc-900">{c.label}</option>
              ))}
            </select>
          </div>
        </PanelHeader>
        <PanelContent className="space-y-3 pt-0">
          {hallItems.achievements.length === 0 && hallItems.certificates.length === 0 ? (
            <p className="text-[12px] text-zinc-500">Nenhuma conquista com esses filtros.</p>
          ) : (
            <>
              {hallItems.achievements.length > 0 && (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {hallItems.achievements.map((a) => {
                    const Icon = ACHIEVEMENT_ICONS[a.tipo] ?? Sparkles;
                    return (
                      <li
                        key={a.id}
                        className="rounded-md border border-white/[0.06] bg-zinc-950/30 px-2.5 py-2"
                      >
                        <div className="flex items-start gap-2">
                          <Icon className="mt-0.5 size-3.5 shrink-0 text-yellow-400" />
                          <div>
                            <p className="text-[12px] font-medium text-zinc-200">{a.titulo}</p>
                            <p className="text-[10px] text-zinc-500">
                              {a.ano} · {getLegacyCategoryLabel(a.categoria)}
                              {a.local ? ` · ${a.local}` : ""}
                            </p>
                            {a.descricao && (
                              <p className="mt-0.5 text-[10px] text-zinc-500">{a.descricao}</p>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {hallItems.certificates.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-zinc-400">Certificados</p>
                  <ul className="space-y-1">
                    {hallItems.certificates.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-2 rounded-md border border-white/[0.04] px-2 py-1.5 text-[11px] text-zinc-300"
                      >
                        <BookOpen className="size-3 shrink-0 text-sky-400" />
                        {c.titulo}
                        <span className="text-zinc-500">
                          · {c.ano}{c.instituicao ? ` · ${c.instituicao}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </PanelContent>
      </Panel>

      <Panel className="border-emerald-500/10 bg-emerald-500/[0.02]">
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Flag className="size-3.5 text-emerald-400" />
            Marcos de Vida
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="pt-0">
          {data.milestones.length === 0 ? (
            <p className="text-[12px] text-zinc-500">Nenhum marco registrado.</p>
          ) : (
            <ul className="space-y-2">
              {data.milestones.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/[0.06] px-2.5 py-2"
                >
                  <div>
                    <p className="text-[12px] font-medium text-zinc-200">{m.titulo}</p>
                    <p className="text-[10px] text-zinc-500">
                      {getLegacyCategoryLabel(m.categoria)}
                      {m.data_marco ? ` · ${m.data_marco.slice(0, 10)}` : ""}
                    </p>
                    {m.descricao && (
                      <p className="mt-0.5 text-[10px] text-zinc-500">{m.descricao}</p>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-medium uppercase ${MILESTONE_STATUS_STYLES[m.status]}`}
                  >
                    {m.status.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelContent>
      </Panel>

      <Panel className="border-violet-500/10 bg-violet-500/[0.02]">
        <PanelHeader>
          <PanelTitle className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-violet-400" />
            Aura Legado · IA
          </PanelTitle>
        </PanelHeader>
        <PanelContent className="pt-0">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {LEGACY_IA_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={iaLoading}
                onClick={() => sendIaMessage(action.prompt, action.id)}
                className="rounded-md border border-violet-400/15 bg-violet-500/[0.06] px-2.5 py-1.5 text-[11px] text-violet-200 hover:bg-violet-500/10 disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>

          <div className="mb-3 max-h-[240px] space-y-2 overflow-y-auto rounded-lg border border-white/[0.06] bg-zinc-950/40 p-2">
            {iaMessages.map((msg, i) => (
              <div
                key={i}
                className={`rounded-lg px-3 py-2 text-[12px] ${
                  msg.role === "user"
                    ? "ml-4 bg-white/[0.06] text-zinc-200"
                    : "mr-4 bg-violet-500/10 text-violet-100"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>
            ))}
            {iaLoading && (
              <div className="mr-4 flex items-center gap-2 text-[12px] text-violet-300">
                <Loader2 className="size-3.5 animate-spin" />
                Analisando sua trajetória...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendIaMessage(iaInput);
            }}
            className="flex gap-2"
          >
            <input
              value={iaInput}
              onChange={(e) => setIaInput(e.target.value)}
              placeholder="Pergunte sobre sua história, conquistas ou evolução..."
              disabled={iaLoading}
              className="h-9 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={iaLoading || !iaInput.trim()}
              className="flex size-9 items-center justify-center rounded-md bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-50"
            >
              <Send className="size-3.5" />
            </button>
          </form>
        </PanelContent>
      </Panel>
    </div>
  );
}
