"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  MessageCircle,
  Phone,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  ListSkeleton,
  MetricsSkeleton,
} from "@/components/dashboard/loading-skeleton";
import {
  useGrowthActions,
  useGrowthAnalyses,
  useGrowthGoals,
  useEventos,
  useGrowthLeads,
  useGrowthMissions,
  useGrowthProfiles,
  useOrcamentos,
} from "@/hooks";
import { buildProfileAnalysisInput, isSupabaseTableMissingError } from "@/lib/growth";
import type {
  GrowthLead,
  GrowthLeadCanal,
  GrowthLeadStatus,
  GrowthProfile,
  GrowthVertical,
} from "@/types/database";
import { formatBRL } from "@/utils/format";
import {
  calculateLevel,
  computeGrowthLeadMetrics,
  computeMonthlyExecutiveScore,
  computeRevenueProgress,
  getGrowthLeadStatusLabel,
  GROWTH_LEAD_STATUSES,
  countCompletedToday,
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
import { AddGrowthLeadModal } from "./add-growth-lead-modal";
import { AddGrowthProfileModal } from "./add-growth-profile-modal";
import { SetGrowthGoalModal } from "./set-growth-goal-modal";
import { FollowUpModal } from "./follow-up-modal";
import { WhatsAppAssistidoModal } from "./whatsapp-assistido-modal";
import {
  buildFollowUpContextFromLead,
  findOrcamentoForLead,
  daysSinceContact,
  getFollowUpIdleTier,
  getFollowUpTierLabel,
  listStaleOpportunities,
} from "@/utils/follow-up";
import {
  buildWhatsAppLeadContext,
} from "@/utils/whatsapp-ia";

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
              ? "Execute a migration supabase/migrations/20250602120000_growth_module.sql no Supabase para habilitar metas, missões, perfis e leads."
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
  const {
    data: growthLeads,
    loading: growthLeadsLoading,
    error: growthLeadsError,
    create: createGrowthLead,
    update: updateGrowthLead,
    remove: removeGrowthLead,
  } = useGrowthLeads();

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [followUpLead, setFollowUpLead] = useState<GrowthLead | null>(null);
  const [whatsAppLead, setWhatsAppLead] = useState<GrowthLead | null>(null);
  const { data: orcamentos } = useOrcamentos();
  const { create: createEvento } = useEventos();
  const [completingKey, setCompletingKey] = useState<string | null>(null);

  const growthDataError =
    goalsError ||
    missionsError ||
    profilesError ||
    actionsError ||
    analysesError ||
    growthLeadsError;

  const loading =
    goalsLoading ||
    missionsLoading ||
    profilesLoading ||
    actionsLoading ||
    growthLeadsLoading;

  const currentGoal = useMemo(() => getCurrentGoal(goals), [goals]);
  const dailyMissions = useMemo(() => mergeDailyMissions(missions), [missions]);
  const completedToday = useMemo(() => countCompletedToday(missions), [missions]);
  const revenueProgress = useMemo(
    () => computeRevenueProgress(currentGoal),
    [currentGoal]
  );
  const leadMetrics = useMemo(
    () => computeGrowthLeadMetrics(growthLeads),
    [growthLeads]
  );

  const staleOpportunities = useMemo(
    () => listStaleOpportunities({ leads: growthLeads, orcamentos }),
    [growthLeads, orcamentos]
  );

  const followUpContext = useMemo(() => {
    if (!followUpLead) return null;
    const orcamento = findOrcamentoForLead(followUpLead, orcamentos);
    return buildFollowUpContextFromLead(followUpLead, orcamento);
  }, [followUpLead, orcamentos]);

  const whatsAppLeadContext = useMemo(() => {
    if (!whatsAppLead) return null;
    const orcamento = findOrcamentoForLead(whatsAppLead, orcamentos);
    return buildWhatsAppLeadContext(whatsAppLead, orcamento);
  }, [whatsAppLead, orcamentos]);
  const executiveScore = useMemo(
    () => computeMonthlyExecutiveScore(missions, growthLeads),
    [missions, growthLeads]
  );
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

  async function handleCreateGrowthLead(payload: {
    nome: string;
    contato: string;
    origem: string;
    canal: GrowthLeadCanal;
    vertical: GrowthVertical | null;
    status: GrowthLeadStatus;
    valor_potencial: number;
    observacoes: string;
  }) {
    const result = await createGrowthLead({
      nome: payload.nome,
      contato: payload.contato || null,
      origem: payload.origem,
      canal: payload.canal,
      vertical: payload.vertical,
      status: payload.status,
      valor_potencial: payload.valor_potencial,
      observacoes: payload.observacoes || null,
    });
    return { error: result.error };
  }

  async function moveGrowthLead(id: string, status: GrowthLeadStatus) {
    const { error } = await updateGrowthLead(id, { status });
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(`Status: ${getGrowthLeadStatusLabel(status)}`);
  }

  async function handleDeleteGrowthLead(lead: GrowthLead) {
    if (
      !confirm(
        `Excluir o lead "${lead.nome}"? Esta ação remove apenas o registro do CRM.`
      )
    ) {
      return;
    }
    const { error } = await removeGrowthLead(lead.id);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Lead excluído.");
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

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <ActionButton
          icon={<Target className="size-3.5" />}
          onClick={() => setGoalModalOpen(true)}
          className="w-full sm:w-auto"
        >
          Definir meta
        </ActionButton>
        <ActionButton
          icon={<Users className="size-3.5" />}
          onClick={() => setLeadModalOpen(true)}
          className="w-full sm:w-auto"
          disabled={Boolean(growthDataError)}
        >
          Novo lead
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
        <>
          <MetricsSkeleton count={5} />
          <MetricsSkeleton count={4} />
        </>
      ) : (
        <>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
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
            label="Score do mês"
            value={`${executiveScore}/100`}
            hint="Missões · leads · vendas · conteúdo"
            hintClassName="text-violet-400/90"
          />
        </div>

        <Panel>
          <PanelHeader>
            <PanelTitle>Leads e vendas</PanelTitle>
          </PanelHeader>
          <PanelContent className="pt-0">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Leads gerados"
                value={growthLeadsError ? "—" : String(leadMetrics.total)}
                hint={
                  leadMetrics.total > 0
                    ? "Total cadastrado"
                    : "Nenhum lead cadastrado"
                }
              />
              <MetricCard
                label="Leads ativos"
                value={growthLeadsError ? "—" : String(leadMetrics.ativos)}
                hint={
                  leadMetrics.ativos > 0
                    ? "Em pipeline"
                    : "Nenhum lead ativo"
                }
                hintClassName="text-cyan-400/90"
              />
              <MetricCard
                label="Vendas fechadas"
                value={growthLeadsError ? "—" : String(leadMetrics.fechados)}
                hint={
                  leadMetrics.fechados > 0
                    ? "Status fechado"
                    : "Nenhuma venda fechada"
                }
              />
              <MetricCard
                label="Leads perdidos"
                value={growthLeadsError ? "—" : String(leadMetrics.perdidos)}
                hint={
                  leadMetrics.perdidos > 0
                    ? "Status perdido"
                    : "Nenhum lead perdido"
                }
              />
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                label="Receita Potencial"
                value={
                  growthLeadsError
                    ? "—"
                    : leadMetrics.receitaPotencial > 0
                      ? formatBRL(leadMetrics.receitaPotencial)
                      : "—"
                }
                hint="Leads não perdidos"
                hintClassName="text-violet-400/90"
              />
              <MetricCard
                label="Receita em Negociação"
                value={
                  growthLeadsError
                    ? "—"
                    : leadMetrics.receitaEmNegociacao > 0
                      ? formatBRL(leadMetrics.receitaEmNegociacao)
                      : "—"
                }
                hint="Status negociação"
                hintClassName="text-amber-400/90"
              />
              <MetricCard
                label="Receita Fechada"
                value={
                  growthLeadsError
                    ? "—"
                    : leadMetrics.receita > 0
                      ? formatBRL(leadMetrics.receita)
                      : "—"
                }
                hint="Vendas confirmadas"
                hintClassName="text-emerald-400/90"
              />
              <MetricCard
                label="Ticket Médio"
                value={
                  growthLeadsError
                    ? "—"
                    : leadMetrics.ticketMedio > 0
                      ? formatBRL(leadMetrics.ticketMedio)
                      : "—"
                }
                hint="Potencial ÷ total de leads"
              />
              <MetricCard
                label="Taxa de Conversão"
                value={
                  growthLeadsError
                    ? "—"
                    : leadMetrics.total > 0
                      ? `${leadMetrics.taxaConversao.toFixed(1)}%`
                      : "—"
                }
                hint="Fechados ÷ total de leads"
                hintClassName="text-cyan-400/90"
              />
            </div>
            {staleOpportunities.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
                <p className="text-[12px] font-medium text-amber-200/90">
                  Follow-ups pendentes ({staleOpportunities.length})
                </p>
                <ul className="mt-2 space-y-1.5">
                  {staleOpportunities.slice(0, 4).map((item) => (
                    <li
                      key={item.lead?.id ?? item.orcamento?.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-[11px]"
                    >
                      <span className="text-zinc-400">
                        {item.context.nome} ·{" "}
                        {item.context.idleTier
                          ? getFollowUpTierLabel(item.context.idleTier)
                          : ""}
                      </span>
                      {item.lead && (
                        <ActionButton
                          variant="ghost"
                          className="w-full sm:w-auto sm:px-2 sm:text-[10px]"
                          icon={<MessageCircle className="size-3" />}
                          onClick={() => setFollowUpLead(item.lead)}
                        >
                          Gerar follow-up
                        </ActionButton>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12px] font-medium text-zinc-300">Lista de leads</p>
                <ActionButton
                  icon={<Plus className="size-3.5" />}
                  variant="ghost"
                  className="w-full sm:w-auto sm:px-2 sm:text-[11px]"
                  disabled={Boolean(growthDataError)}
                  onClick={() => setLeadModalOpen(true)}
                >
                  Adicionar
                </ActionButton>
              </div>
              {growthLeadsLoading ? (
                <ListSkeleton rows={4} />
              ) : growthLeads.length === 0 ? (
                <EmptyState
                  title="Nenhum lead cadastrado"
                  description="Cadastre leads da Alvesz, consórcios ou marca pessoal."
                  action={
                    <ActionButton
                      icon={<Plus className="size-3.5" />}
                      onClick={() => setLeadModalOpen(true)}
                      disabled={Boolean(growthDataError)}
                    >
                      Novo lead
                    </ActionButton>
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {growthLeads.map((lead) => {
                    const idleTier = getFollowUpIdleTier(
                      daysSinceContact(lead.updated_at)
                    );
                    return (
                    <li
                      key={lead.id}
                      className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-zinc-200">{lead.nome}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-600">
                          {[lead.origem, lead.contato].filter(Boolean).join(" · ") ||
                            "Sem contato"}
                        </p>
                        {idleTier && (
                          <p className="mt-0.5 text-[10px] text-amber-400/90">
                            {getFollowUpTierLabel(idleTier)}
                          </p>
                        )}
                        {lead.valor_potencial > 0 && (
                          <p className="mt-0.5 text-[11px] text-cyan-400/90">
                            {formatBRL(lead.valor_potencial)}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                      <ActionButton
                        variant="ghost"
                        className="w-full px-2 text-[11px] sm:w-auto sm:text-[10px]"
                        icon={<Phone className="size-3" />}
                        onClick={() => setWhatsAppLead(lead)}
                      >
                        Mensagem WhatsApp
                      </ActionButton>
                      {idleTier && (
                        <ActionButton
                          variant="ghost"
                          className="w-full px-2 text-[11px] sm:w-auto sm:text-[10px]"
                          icon={<MessageCircle className="size-3" />}
                          onClick={() => setFollowUpLead(lead)}
                        >
                          Gerar follow-up
                        </ActionButton>
                      )}
                      <select
                        value={lead.status}
                        onChange={(e) =>
                          moveGrowthLead(lead.id, e.target.value as GrowthLeadStatus)
                        }
                        disabled={Boolean(growthDataError)}
                        className="min-h-11 w-full shrink-0 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-300 sm:min-h-8 sm:h-8 sm:w-40 sm:px-2 sm:text-[12px]"
                      >
                        {GROWTH_LEAD_STATUSES.map((s) => (
                          <option key={s.value} value={s.value} className="bg-zinc-900">
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <ActionButton
                        variant="ghost"
                        className="w-full px-2 text-[11px] text-red-400/90 hover:text-red-400 sm:w-auto sm:text-[10px]"
                        icon={<Trash2 className="size-3" />}
                        disabled={Boolean(growthDataError)}
                        onClick={() => handleDeleteGrowthLead(lead)}
                      >
                        Excluir
                      </ActionButton>
                      </div>
                    </li>
                  );
                  })}
                </ul>
              )}
            </div>
          </PanelContent>
        </Panel>
        </>
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
                        className="w-full px-2 text-[11px] sm:w-auto"
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

      <AddGrowthLeadModal
        open={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        onSubmit={handleCreateGrowthLead}
      />

      <FollowUpModal
        open={followUpLead !== null}
        onClose={() => setFollowUpLead(null)}
        context={followUpContext}
        onScheduleFollowUp={async (payload) => {
          const result = await createEvento(payload);
          return { error: result.error };
        }}
        onMarkContacted={
          followUpLead
            ? async () => {
                const { error } = await updateGrowthLead(followUpLead.id, {
                  observacoes: followUpLead.observacoes,
                });
                return { error };
              }
            : undefined
        }
      />

      {whatsAppLead && whatsAppLeadContext && (
        <WhatsAppAssistidoModal
          open
          onClose={() => setWhatsAppLead(null)}
          title="Mensagem WhatsApp"
          description="Gere uma mensagem com dados reais do lead."
          telefone={whatsAppLead.contato}
          intent="lead"
          context={whatsAppLeadContext}
          onMarkContacted={async () => {
            const { error } = await updateGrowthLead(whatsAppLead.id, {
              observacoes: whatsAppLead.observacoes,
            });
            return { error };
          }}
        />
      )}

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
