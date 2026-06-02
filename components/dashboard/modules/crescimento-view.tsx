"use client";

import { AlertTriangle, CheckCircle2, Circle, Plus, Sparkles, Target, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/empty-state";
import { MetricsSkeleton } from "@/components/dashboard/loading-skeleton";
import {
  useGrowthActions,
  useGrowthAnalyses,
  useGrowthGoals,
  useGrowthMissions,
  useGrowthProfiles,
  useLeads,
} from "@/hooks";
import { buildProfileAnalysisInput, isSupabaseTableMissingError } from "@/lib/growth";
import type { GrowthProfile } from "@/types/database";
import { formatBRL } from "@/utils/format";
import {
  AURA_MENTOR_SUGGESTIONS,
  calculateLevel,
  computeRevenueProgress,
  countCompletedToday,
  countLeadsThisMonth,
  getActionForVertical,
  getCurrentGoal,
  getCurrentMonthReference,
  getLatestAnalysisForProfile,
  getTodayDate,
  hasAnySalesAction,
  isSalesActionConfigured,
  mergeDailyMissions,
  SALES_FUNNEL_STEPS,
  SALES_VERTICALS,
} from "@/utils/growth";
import { ActionButton } from "../action-button";
import { MetricCard } from "../metric-card";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "../panel";
import { AddGrowthProfileModal } from "./add-growth-profile-modal";
import { SetGrowthGoalModal } from "./set-growth-goal-modal";

function GrowthDataError({
  message,
  hintMigration = true,
}: {
  message: string;
  hintMigration?: boolean;
}) {
  const needsMigration = hintMigration && isSupabaseTableMissingError(message);
  return (
    <Panel className="border-amber-500/20 bg-amber-500/[0.04]">
      <PanelContent className="flex gap-3 py-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-zinc-200">
            {needsMigration
              ? "Tabelas do Crescimento Digital ainda não existem"
              : "Erro ao carregar dados"}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {needsMigration
              ? "Execute a migration supabase/migrations/20250602120000_growth_module.sql no Supabase para habilitar metas, missões e perfis."
              : message}
          </p>
        </div>
      </PanelContent>
    </Panel>
  );
}

function EmptyFieldValue({ label }: { label?: string }) {
  return (
    <span className="text-[12px] italic text-zinc-600">
      {label ?? "Não cadastrado"}
    </span>
  );
}

function AnalysisStatusBadge({ status }: { status: string }) {
  const styles =
    status === "completed"
      ? "bg-emerald-500/10 text-emerald-400"
      : status === "failed"
        ? "bg-rose-500/10 text-rose-400"
        : "bg-amber-500/10 text-amber-400";
  const label =
    status === "completed" ? "Análise concluída" : status === "failed" ? "Falhou" : "Análise pendente";
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${styles}`}>
      {label}
    </span>
  );
}

export function CrescimentoView() {
  const {
    data: goals,
    loading: goalsLoading,
    error: goalsError,
    create: createGoal,
    update: updateGoal,
  } = useGrowthGoals();
  const {
    data: missions,
    loading: missionsLoading,
    error: missionsError,
    create: createMission,
    update: updateMission,
  } = useGrowthMissions();
  const {
    data: profiles,
    loading: profilesLoading,
    error: profilesError,
    create: createProfile,
  } = useGrowthProfiles();
  const { data: actions, loading: actionsLoading, error: actionsError } = useGrowthActions();
  const { data: analyses, create: createAnalysis, error: analysesError } = useGrowthAnalyses();
  const { data: leads, loading: leadsLoading, error: leadsError } = useLeads();

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [mentorPrompt, setMentorPrompt] = useState<string | null>(null);
  const [completingKey, setCompletingKey] = useState<string | null>(null);

  const growthDataError =
    goalsError || missionsError || profilesError || actionsError || analysesError;

  const loading =
    goalsLoading || missionsLoading || profilesLoading || actionsLoading || leadsLoading;

  const currentGoal = useMemo(() => getCurrentGoal(goals), [goals]);
  const dailyMissions = useMemo(() => mergeDailyMissions(missions), [missions]);
  const completedToday = useMemo(() => countCompletedToday(missions), [missions]);
  const revenueProgress = useMemo(
    () => computeRevenueProgress(currentGoal),
    [currentGoal]
  );
  const leadsThisMonth = useMemo(() => countLeadsThisMonth(leads), [leads]);
  const hasXp = (currentGoal?.xp_total ?? 0) > 0;

  const xp = currentGoal?.xp_total ?? 0;
  const nivel = hasXp ? (currentGoal?.nivel ?? calculateLevel(xp)) : null;

  async function ensureCurrentGoal() {
    if (currentGoal) return { goal: currentGoal, error: null as string | null };
    const mesReferencia = getCurrentMonthReference();
    const result = await createGoal({
      meta_receita_mensal: 0,
      receita_atual: 0,
      xp_total: 0,
      nivel: 1,
      mes_referencia: mesReferencia,
    });
    return { goal: result.data, error: result.error };
  }

  async function handleSetGoal(metaReceita: number) {
    const mesReferencia = getCurrentMonthReference();
    if (currentGoal) {
      return updateGoal(currentGoal.id, { meta_receita_mensal: metaReceita });
    }
    return createGoal({
      meta_receita_mensal: metaReceita,
      receita_atual: 0,
      xp_total: 0,
      nivel: 1,
      mes_referencia: mesReferencia,
    });
  }

  async function handleCreateProfile(payload: {
    plataforma: string;
    username: string;
    nicho: string;
    objetivo: string;
    observacoes: string;
  }) {
    return createProfile({
      plataforma: payload.plataforma,
      username: payload.username.replace(/^@/, ""),
      nicho: payload.nicho.trim() || null,
      objetivo: payload.objetivo.trim() || null,
      observacoes: payload.observacoes.trim() || null,
    });
  }

  async function handleCompleteMission(
    missionKey: string,
    titulo: string,
    descricao: string,
    xpReward: number,
    recordId?: string
  ) {
    setCompletingKey(missionKey);
    const today = getTodayDate();
    const completedAt = new Date().toISOString();

    let error: string | null = null;

    if (recordId) {
      const result = await updateMission(recordId, {
        status: "completed",
        completed_at: completedAt,
      });
      error = result.error;
    } else {
      const result = await createMission({
        mission_key: missionKey,
        titulo,
        descricao,
        xp_reward: xpReward,
        status: "completed",
        mission_date: today,
        completed_at: completedAt,
      });
      error = result.error;
    }

    if (error) {
      toast.error(error);
      setCompletingKey(null);
      return;
    }

    const ensured = currentGoal
      ? { goal: currentGoal, error: null as string | null }
      : await ensureCurrentGoal();

    if (ensured.error || !ensured.goal) {
      toast.error(
        ensured.error ?? "Missão salva, mas não foi possível registrar o XP."
      );
      setCompletingKey(null);
      return;
    }

    const newXp = (ensured.goal.xp_total ?? 0) + xpReward;
    const xpResult = await updateGoal(ensured.goal.id, {
      xp_total: newXp,
      nivel: calculateLevel(newXp),
    });

    if (xpResult.error) {
      toast.error("Missão salva, mas o XP não foi atualizado.");
      setCompletingKey(null);
      return;
    }

    toast.success(`Missão concluída! +${xpReward} XP`);
    setCompletingKey(null);
  }

  async function handleAnalyzeProfile(profile: GrowthProfile) {
    const input = buildProfileAnalysisInput(profile);
    const { error } = await createAnalysis({
      profile_id: profile.id,
      status: "pending",
      conteudo: JSON.stringify({ input, source: "manual" }),
    });
    if (error) {
      toast.error(error);
      return;
    }
    toast.info(
      "Análise registrada como pendente. A Aura IA usará os dados cadastrados quando a integração estiver ativa."
    );
  }

  return (
    <div className="space-y-3">
      {growthDataError && !loading && (
        <GrowthDataError message={growthDataError} />
      )}
      {leadsError && !loading && !growthDataError && (
        <GrowthDataError message={leadsError} hintMigration={false} />
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <ActionButton
          icon={<Target className="size-3.5" />}
          onClick={() => setGoalModalOpen(true)}
          className="w-full sm:w-auto"
        >
          Definir meta
        </ActionButton>
        <ActionButton
          icon={<Plus className="size-3.5" />}
          onClick={() => setProfileModalOpen(true)}
          className="w-full sm:w-auto"
        >
          Cadastrar perfil
        </ActionButton>
      </div>

      {loading ? (
        <MetricsSkeleton count={6} />
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 2xl:grid-cols-6">
          <MetricCard
            label="Meta mensal"
            value={
              currentGoal && currentGoal.meta_receita_mensal > 0
                ? formatBRL(currentGoal.meta_receita_mensal)
                : "—"
            }
            hint={
              currentGoal && currentGoal.meta_receita_mensal > 0
                ? "Receita alvo do mês"
                : "Defina sua meta mensal"
            }
          />
          <MetricCard
            label="Progresso"
            value={
              currentGoal && currentGoal.meta_receita_mensal > 0
                ? `${revenueProgress}%`
                : "—"
            }
            hint={
              currentGoal && currentGoal.receita_atual > 0
                ? formatBRL(currentGoal.receita_atual)
                : "Nenhuma receita registrada"
            }
            hintClassName="text-cyan-400/90"
          />
          <MetricCard
            label="XP atual"
            value={hasXp ? String(xp) : "—"}
            hint={nivel ? `Nível ${nivel}` : "Complete missões para ganhar XP"}
          />
          <MetricCard
            label="Nível"
            value={nivel ? String(nivel) : "—"}
            hint={hasXp ? "Baseado no XP acumulado" : "Sem progresso ainda"}
          />
          <MetricCard
            label="Missões hoje"
            value={`${completedToday}/${dailyMissions.length}`}
            hint={
              completedToday > 0
                ? "Concluídas hoje"
                : "Nenhuma missão concluída hoje"
            }
          />
          <MetricCard
            label="Leads gerados"
            value={leadsError ? "—" : String(leadsThisMonth)}
            hint={
              leadsError
                ? "Indisponível"
                : leadsThisMonth > 0
                  ? "Este mês · módulo Consórcios"
                  : "Nenhum lead este mês"
            }
          />
        </div>
      )}

      <Panel>
        <PanelHeader>
          <PanelTitle>Missões diárias</PanelTitle>
        </PanelHeader>
        <PanelContent className="pt-0">
          <p className="mb-3 text-[11px] text-zinc-600">
            Modelo de rotina diária. Conclua para registrar XP no Supabase.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {dailyMissions.map((mission) => {
              const isCompleted = mission.status === "completed";
              const isSaving = completingKey === mission.key;
              return (
                <div
                  key={mission.key}
                  className="flex flex-col rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      {isCompleted ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                      ) : (
                        <Circle className="mt-0.5 size-4 shrink-0 text-zinc-600" />
                      )}
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-zinc-200">
                          {mission.titulo}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-600">
                          {mission.descricao}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-400">
                      +{mission.xp} XP
                    </span>
                  </div>
                  <div className="mt-auto flex flex-col gap-2 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <span
                      className={`text-[10px] font-medium uppercase tracking-wide ${
                        isCompleted ? "text-emerald-400" : "text-zinc-500"
                      }`}
                    >
                      {isCompleted ? "Concluída" : "Pendente"}
                    </span>
                    {!isCompleted && (
                      <ActionButton
                        variant="ghost"
                        className="h-7 w-full px-2 text-[11px] sm:w-auto"
                        disabled={isSaving || Boolean(growthDataError)}
                        onClick={() =>
                          handleCompleteMission(
                            mission.key,
                            mission.titulo,
                            mission.descricao,
                            mission.xp,
                            mission.recordId
                          )
                        }
                      >
                        {isSaving ? "Salvando..." : "Concluir"}
                      </ActionButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <div className="flex min-w-0 items-center gap-2">
            <TrendingUp className="size-3.5 shrink-0 text-cyan-400" />
            <PanelTitle className="truncate">
              Máquina de vendas pela internet
            </PanelTitle>
          </div>
        </PanelHeader>
        <PanelContent className="pt-0">
          {!actionsLoading && !hasAnySalesAction(actions) && (
            <div className="mb-3 rounded-lg border border-dashed border-white/[0.06] px-3 py-4 text-center">
              <p className="text-[13px] font-medium text-zinc-400">
                Nenhuma estratégia de venda cadastrada
              </p>
              <p className="mt-1 text-[11px] text-zinc-600">
                Configure ofertas, canais e funis por vertical quando estiver pronto.
              </p>
            </div>
          )}
          <div className="grid gap-2 lg:grid-cols-3">
            {SALES_VERTICALS.map((vertical) => {
              const action = getActionForVertical(actions, vertical.id);
              const configured = isSalesActionConfigured(action);
              const fields = [
                { label: "Oferta principal", value: action?.oferta_principal },
                { label: "Canal de venda", value: action?.canal_venda },
                { label: "Público-alvo", value: action?.publico_alvo },
                { label: "CTA", value: action?.cta },
              ];
              return (
                <div
                  key={vertical.id}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <p className="text-[13px] font-medium text-zinc-200">{vertical.label}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-600">{vertical.description}</p>

                  <div className="mt-3 space-y-2">
                    {fields.map((field) => (
                      <div key={field.label}>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                          {field.label}
                        </p>
                        <p className="mt-0.5 break-words text-[12px]">
                          {field.value ? (
                            <span className="text-zinc-400">{field.value}</span>
                          ) : (
                            <EmptyFieldValue />
                          )}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 border-t border-white/[0.06] pt-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                      Modelo de funil
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {SALES_FUNNEL_STEPS.map((step, i) => (
                        <span
                          key={step}
                          className="rounded-md border border-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-600"
                        >
                          {i + 1}. {step}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 break-words text-[11px]">
                      {action?.funil ? (
                        <span className="text-zinc-500">{action.funil}</span>
                      ) : (
                        <EmptyFieldValue label="Funil não configurado" />
                      )}
                    </p>
                  </div>

                  <div className="mt-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                      Ideias de ação
                    </p>
                    <p className="mt-1 break-words text-[11px]">
                      {action?.ideias_acao ? (
                        <span className="text-zinc-500">{action.ideias_acao}</span>
                      ) : (
                        <EmptyFieldValue label="Nenhuma ideia cadastrada" />
                      )}
                    </p>
                  </div>

                  {!configured && hasAnySalesAction(actions) && (
                    <p className="mt-3 text-[10px] text-zinc-700">
                      Vertical sem dados cadastrados
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </PanelContent>
      </Panel>

      <div className="grid gap-2 lg:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Análise de perfis</PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            {profilesLoading ? (
              <p className="py-6 text-center text-[12px] text-zinc-600">Carregando...</p>
            ) : profiles.length === 0 ? (
              <EmptyState
                title="Nenhum perfil cadastrado"
                description="Cadastre perfis manualmente. A Instagram API será integrada futuramente."
                action={
                  <ActionButton
                    icon={<Plus className="size-3.5" />}
                    onClick={() => setProfileModalOpen(true)}
                  >
                    Cadastrar perfil
                  </ActionButton>
                }
              />
            ) : (
              <div className="space-y-2">
                {profiles.map((profile) => {
                  const latestAnalysis = getLatestAnalysisForProfile(analyses, profile.id);
                  return (
                    <div
                      key={profile.id}
                      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="break-words text-[13px] font-medium text-zinc-200">
                            {profile.plataforma} · @{profile.username.replace(/^@/, "")}
                          </p>
                          {profile.nicho && (
                            <p className="mt-0.5 text-[11px] text-zinc-500">
                              Nicho: {profile.nicho}
                            </p>
                          )}
                          {profile.objetivo && (
                            <p className="text-[11px] text-zinc-600">
                              Objetivo: {profile.objetivo}
                            </p>
                          )}
                          {profile.observacoes && (
                            <p className="mt-1 break-words text-[11px] text-zinc-600">
                              {profile.observacoes}
                            </p>
                          )}
                        </div>
                        {latestAnalysis && (
                          <AnalysisStatusBadge status={latestAnalysis.status} />
                        )}
                      </div>
                      <div className="mt-3">
                        <ActionButton
                          icon={<Sparkles className="size-3.5" />}
                          className="w-full sm:w-auto"
                          disabled={Boolean(growthDataError)}
                          onClick={() => handleAnalyzeProfile(profile)}
                        >
                          Analisar perfil com IA
                        </ActionButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="size-3.5 shrink-0 text-violet-400" />
              <PanelTitle>Aura Mentor</PanelTitle>
            </div>
          </PanelHeader>
          <PanelContent className="pt-0">
            <p className="mb-3 text-[11px] text-zinc-600">
              Atalhos preparados para o módulo Crescimento. Conexão com Aura IA em breve.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {AURA_MENTOR_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => setMentorPrompt(suggestion.prompt)}
                  className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-zinc-400 transition-colors hover:border-white/[0.1] hover:bg-white/[0.04] hover:text-zinc-200"
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
            <div className="mt-3 min-h-[100px] rounded-lg border border-dashed border-white/[0.06] p-3">
              {mentorPrompt ? (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                    Contexto preparado
                  </p>
                  <p className="mt-1 break-words text-[12px] text-zinc-400">{mentorPrompt}</p>
                  <p className="mt-2 text-[11px] text-zinc-600">
                    Este prompt será enviado ao Aura IA quando a integração estiver ativa.
                  </p>
                </div>
              ) : (
                <p className="py-4 text-center text-[12px] text-zinc-600">
                  Selecione uma sugestão acima para preparar o contexto.
                </p>
              )}
            </div>
          </PanelContent>
        </Panel>
      </div>

      <AddGrowthProfileModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onSubmit={handleCreateProfile}
      />

      <SetGrowthGoalModal
        open={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        currentMeta={currentGoal?.meta_receita_mensal}
        onSubmit={handleSetGoal}
      />
    </div>
  );
}
