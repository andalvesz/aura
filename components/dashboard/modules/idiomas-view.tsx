"use client";

import { useMemo, useState } from "react";
import { Check, Flame, GraduationCap, Trophy } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  ListSkeleton,
  MetricsSkeleton,
} from "@/components/dashboard/loading-skeleton";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import {
  useLanguageLessons,
  useLanguageProgress,
  useLanguageSessions,
} from "@/hooks";
import type { LanguageLesson, LanguageModo } from "@/types/database";
import {
  ENGLISH_MODOS,
  getEnglishModoLabel,
  getStreakEmoji,
  type ParsedEnglishLesson,
} from "@/utils/english";
import { parseJsonResponse } from "@/utils/safe-json";
import { AuraEnglish } from "./aura-english";

export function IdiomasView() {
  const { data: progress, loading: loadingProgress, refresh: refreshProgress } =
    useLanguageProgress();
  const { data: lessons, loading: loadingLessons, refresh: refreshLessons } =
    useLanguageLessons();
  const { data: sessions, refresh: refreshSessions } = useLanguageSessions();

  const [modo, setModo] = useState<LanguageModo>("viagens");
  const [activeLesson, setActiveLesson] = useState<ParsedEnglishLesson | null>(null);
  const [pendingLessonId, setPendingLessonId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loading = loadingProgress || loadingLessons;

  const modoLessons = useMemo(
    () => lessons.filter((l) => l.modo === modo),
    [lessons, modo]
  );

  const modoSessions = useMemo(
    () => sessions.filter((s) => s.modo === modo),
    [sessions, modo]
  );

  const modoProgress = useMemo(() => {
    const total = modoLessons.length;
    const done = modoLessons.filter((l) => l.status === "concluido").length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, pct };
  }, [modoLessons]);

  async function handleCompleteLesson(lessonId: string) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete-lesson", lessonId }),
      });
      const { data, error } = await parseJsonResponse<{ error?: string }>(res);
      if (error || data?.error) {
        toast.error(data?.error ?? error ?? "Erro ao concluir aula.");
        return;
      }
      toast.success("Aula concluída! +10 XP");
      setPendingLessonId(null);
      setActiveLesson(null);
      await Promise.all([refreshLessons(), refreshProgress()]);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCompleteModule() {
    setActionLoading(true);
    try {
      const res = await fetch("/api/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete-module", modo }),
      });
      const { data, error } = await parseJsonResponse<{ error?: string }>(res);
      if (error || data?.error) {
        toast.error(data?.error ?? error ?? "Erro ao concluir módulo.");
        return;
      }
      toast.success("Módulo completo! +20 XP");
      await refreshProgress();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCompleteExercise(sessionId: string) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete-exercise", sessionId }),
      });
      const { data, error } = await parseJsonResponse<{ error?: string }>(res);
      if (error || data?.error) {
        toast.error(data?.error ?? error ?? "Erro ao concluir exercício.");
        return;
      }
      toast.success("Exercício concluído! +5 XP");
      await Promise.all([refreshSessions(), refreshProgress()]);
    } finally {
      setActionLoading(false);
    }
  }

  function handleLessonGenerated(lesson: ParsedEnglishLesson, lessonId: string | null) {
    setActiveLesson(lesson);
    setPendingLessonId(lessonId);
    void refreshLessons();
    void refreshSessions();
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <MetricsSkeleton count={3} />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <MetricCard
          label="Streak"
          value={`${progress?.streak_dias ?? 0}d`}
          hint={`${getStreakEmoji(progress?.streak_dias ?? 0)} Estudo diário`}
          hintClassName="text-amber-400/80"
        />
        <MetricCard
          label="Aulas concluídas"
          value={String(progress?.aulas_concluidas ?? 0)}
          hint={`${progress?.exercicios_concluidos ?? 0} exercícios feitos`}
        />
        <MetricCard
          label="Módulos completos"
          value={String(progress?.modulos_concluidos ?? 0)}
          hint={`Nível: ${progress?.nivel ?? "intermediario"}`}
        />
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle>Modo de estudo</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <div className="flex flex-wrap gap-1.5">
            {ENGLISH_MODOS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModo(m.id)}
                className={`rounded-md border px-2.5 py-1.5 text-[11px] transition-colors ${
                  modo === m.id
                    ? "border-violet-500/40 bg-violet-500/15 text-violet-200"
                    : "border-white/[0.06] bg-white/[0.02] text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-zinc-600">
            Progresso do módulo: {modoProgress.pct}% ({modoProgress.done}/{modoProgress.total})
          </p>
        </PanelContent>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        <AuraEnglish modo={modo} onLessonGenerated={handleLessonGenerated} />

        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <GraduationCap className="size-3.5 text-violet-400" />
              Aula atual
            </PanelTitle>
          </PanelHeader>
          <PanelContent>
            {!activeLesson ? (
              <EmptyState
                title="Nenhuma aula ativa"
                description="Peça uma aula diária ou escolha um modo para a IA gerar conteúdo."
              />
            ) : (
              <div className="space-y-3 text-[12px]">
                <div>
                  <p className="font-medium text-zinc-200">{activeLesson.titulo}</p>
                  <p className="mt-1 text-zinc-500">{activeLesson.introducao}</p>
                </div>

                {activeLesson.vocabulario.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                      Vocabulário
                    </p>
                    <ul className="space-y-1 text-zinc-400">
                      {activeLesson.vocabulario.map((v, i) => (
                        <li key={i}>
                          <strong className="text-zinc-300">{v.termo}</strong> — {v.traducao}
                          {v.exemplo && (
                            <span className="block text-zinc-600">{v.exemplo}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {activeLesson.frases.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                      Frases úteis
                    </p>
                    <ul className="space-y-1 text-zinc-400">
                      {activeLesson.frases.map((f, i) => (
                        <li key={i}>
                          {f.ingles} — <span className="text-zinc-500">{f.portugues}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {activeLesson.exercicios.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                      Exercícios
                    </p>
                    <ul className="space-y-2 text-zinc-400">
                      {activeLesson.exercicios.map((e, i) => (
                        <li key={i} className="rounded-md border border-white/[0.06] p-2">
                          {e.pergunta}
                          {e.dica && (
                            <span className="block text-[11px] text-zinc-600">Dica: {e.dica}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {pendingLessonId && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => void handleCompleteLesson(pendingLessonId)}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] font-medium text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-50"
                  >
                    <Check className="size-3.5" />
                    Concluir aula (+10 XP)
                  </button>
                )}
              </div>
            )}
          </PanelContent>
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Lições — {getEnglishModoLabel(modo)}</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            {!modoLessons.length ? (
              <p className="text-[12px] text-zinc-500">Nenhuma lição neste módulo.</p>
            ) : (
              modoLessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  onComplete={() => void handleCompleteLesson(lesson.id)}
                  loading={actionLoading}
                />
              ))
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle className="flex items-center gap-2">
              <Flame className="size-3.5 text-amber-400" />
              Sessões recentes
            </PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-2">
            {!modoSessions.length ? (
              <p className="text-[12px] text-zinc-500">Nenhuma sessão registrada.</p>
            ) : (
              modoSessions.slice(0, 8).map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-white/[0.06] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12px] text-zinc-300">{session.titulo}</p>
                    <p className="text-[11px] text-zinc-600">
                      {session.tipo} · {session.status} · {session.data}
                    </p>
                  </div>
                  {session.tipo === "exercicio" && session.status !== "concluido" && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => void handleCompleteExercise(session.id)}
                      className="shrink-0 text-[11px] text-violet-400 hover:underline disabled:opacity-50"
                    >
                      +5 XP
                    </button>
                  )}
                </div>
              ))
            )}

            {modoProgress.total > 0 && modoProgress.pct === 100 && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void handleCompleteModule()}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] font-medium text-amber-300 hover:bg-amber-500/15 disabled:opacity-50"
              >
                <Trophy className="size-3.5" />
                Completar módulo (+20 XP)
              </button>
            )}
          </PanelContent>
        </Panel>
      </div>
    </div>
  );
}

function LessonRow({
  lesson,
  onComplete,
  loading,
}: {
  lesson: LanguageLesson;
  onComplete: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-white/[0.06] px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-[12px] text-zinc-300">{lesson.titulo}</p>
        <p className="text-[11px] text-zinc-600">{lesson.status}</p>
      </div>
      {lesson.status !== "concluido" && (
        <button
          type="button"
          disabled={loading}
          onClick={onComplete}
          className="shrink-0 text-[11px] text-emerald-400 hover:underline disabled:opacity-50"
        >
          Concluir
        </button>
      )}
      {lesson.status === "concluido" && (
        <Check className="size-3.5 shrink-0 text-emerald-400" />
      )}
    </div>
  );
}
