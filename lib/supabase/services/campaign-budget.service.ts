import { CreatorAdsCampaignsRepository } from "@/lib/supabase/repositories/creator-ads.repository";
import { CreatorCampaignOrchestrationsRepository } from "@/lib/supabase/repositories/campaign-orchestrator.repository";
import { CreatorLaunchPlansRepository } from "@/lib/supabase/repositories/launch.repository";
import { MoneyMissionPlansRepository } from "@/lib/supabase/repositories/money.repository";
import type {
  CreatorAdsCampaign,
  CreatorCampaignOrchestration,
  CreatorLaunchPlan,
  MoneyMissionPlan,
} from "@/types/database";
import {
  buildBudgetAiRules,
  parseBudgetInput,
  type BudgetSource,
  type ResolvedUserBudget,
} from "@/utils/campaign-budget";
import { formatBRL } from "@/utils/format";
import { getOptionalDataContext } from "./context";

export type BudgetScope = "money" | "ads" | "orchestration" | "launch";

export async function getResolvedUserBudget(): Promise<{
  budget: ResolvedUserBudget;
  moneyPlan: MoneyMissionPlan | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      budget: { orcamento: null, source: null, sourceId: null },
      moneyPlan: null,
      error: "Usuário não autenticado.",
    };
  }

  const moneyRepo = new MoneyMissionPlansRepository(ctx.supabase, ctx.userId);
  const adsRepo = new CreatorAdsCampaignsRepository(ctx.supabase, ctx.userId);
  const orchRepo = new CreatorCampaignOrchestrationsRepository(ctx.supabase, ctx.userId);
  const launchRepo = new CreatorLaunchPlansRepository(ctx.supabase, ctx.userId);

  const [{ data: moneyPlan }, { data: ads }, { data: orch }, { data: launches }] =
    await Promise.all([
      moneyRepo.findActive(),
      adsRepo.findAllOrdered(),
      orchRepo.findAllOrdered(),
      launchRepo.findAllOrdered(),
    ]);

  if (moneyPlan?.orcamento_disponivel != null && Number(moneyPlan.orcamento_disponivel) > 0) {
    return {
      budget: {
        orcamento: Number(moneyPlan.orcamento_disponivel),
        source: "money",
        sourceId: moneyPlan.id,
      },
      moneyPlan: moneyPlan as MoneyMissionPlan,
      error: null,
    };
  }

  const latestAds = (ads ?? [])[0] as CreatorAdsCampaign | undefined;
  if (latestAds?.orcamento_disponivel != null && Number(latestAds.orcamento_disponivel) > 0) {
    return {
      budget: {
        orcamento: Number(latestAds.orcamento_disponivel),
        source: "ads",
        sourceId: latestAds.id,
      },
      moneyPlan: (moneyPlan as MoneyMissionPlan | null) ?? null,
      error: null,
    };
  }

  const latestOrch = (orch ?? [])[0] as CreatorCampaignOrchestration | undefined;
  if (latestOrch?.orcamento_disponivel != null && Number(latestOrch.orcamento_disponivel) > 0) {
    return {
      budget: {
        orcamento: Number(latestOrch.orcamento_disponivel),
        source: "orchestration",
        sourceId: latestOrch.id,
      },
      moneyPlan: (moneyPlan as MoneyMissionPlan | null) ?? null,
      error: null,
    };
  }

  const latestLaunch = (launches ?? [])[0] as CreatorLaunchPlan | undefined;
  if (latestLaunch?.orcamento_disponivel != null && Number(latestLaunch.orcamento_disponivel) > 0) {
    return {
      budget: {
        orcamento: Number(latestLaunch.orcamento_disponivel),
        source: "launch",
        sourceId: latestLaunch.id,
      },
      moneyPlan: (moneyPlan as MoneyMissionPlan | null) ?? null,
      error: null,
    };
  }

  return {
    budget: { orcamento: null, source: null, sourceId: null },
    moneyPlan: (moneyPlan as MoneyMissionPlan | null) ?? null,
    error: null,
  };
}

export function buildBudgetContextBlock(orcamento: number | null): string {
  if (orcamento == null || orcamento <= 0) {
    return "## ORÇAMENTO DISPONÍVEL\nNão informado pelo usuário.";
  }
  return `## ORÇAMENTO DISPONÍVEL\n${formatBRL(orcamento)}\n${buildBudgetAiRules(orcamento)}`;
}

export async function updateUserAvailableBudget(input: {
  orcamento_disponivel: number;
  scope?: BudgetScope;
  entity_id?: string | null;
}): Promise<{ budget: ResolvedUserBudget; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { budget: { orcamento: null, source: null, sourceId: null }, error: "Usuário não autenticado." };
  }

  const orcamento = parseBudgetInput(input.orcamento_disponivel);
  if (orcamento == null) {
    return { budget: { orcamento: null, source: null, sourceId: null }, error: "Informe um orçamento válido." };
  }

  const scope = input.scope;
  const entityId = input.entity_id?.trim() || null;

  if (scope === "ads" && entityId) {
    const repo = new CreatorAdsCampaignsRepository(ctx.supabase, ctx.userId);
    const { data, error } = await repo.update(entityId, { orcamento_disponivel: orcamento });
    if (error || !data) return { budget: { orcamento: null, source: null, sourceId: null }, error: error ?? "Erro ao salvar." };
    return { budget: { orcamento, source: "ads", sourceId: data.id }, error: null };
  }

  if (scope === "orchestration" && entityId) {
    const repo = new CreatorCampaignOrchestrationsRepository(ctx.supabase, ctx.userId);
    const { data, error } = await repo.update(entityId, { orcamento_disponivel: orcamento });
    if (error || !data) return { budget: { orcamento: null, source: null, sourceId: null }, error: error ?? "Erro ao salvar." };
    return { budget: { orcamento, source: "orchestration", sourceId: data.id }, error: null };
  }

  if (scope === "launch" && entityId) {
    const repo = new CreatorLaunchPlansRepository(ctx.supabase, ctx.userId);
    const { data, error } = await repo.update(entityId, { orcamento_disponivel: orcamento });
    if (error || !data) return { budget: { orcamento: null, source: null, sourceId: null }, error: error ?? "Erro ao salvar." };
    return { budget: { orcamento, source: "launch", sourceId: data.id }, error: null };
  }

  const moneyRepo = new MoneyMissionPlansRepository(ctx.supabase, ctx.userId);
  if (entityId) {
    const { data, error } = await moneyRepo.update(entityId, { orcamento_disponivel: orcamento });
    if (error || !data) return { budget: { orcamento: null, source: null, sourceId: null }, error: error ?? "Erro ao salvar." };
    return { budget: { orcamento, source: "money", sourceId: data.id }, error: null };
  }

  const { data: active } = await moneyRepo.findActive();
  if (active) {
    const { data, error } = await moneyRepo.update(active.id, { orcamento_disponivel: orcamento });
    if (error || !data) return { budget: { orcamento: null, source: null, sourceId: null }, error: error ?? "Erro ao salvar." };
    return { budget: { orcamento, source: "money", sourceId: data.id }, error: null };
  }

  const adsRepo = new CreatorAdsCampaignsRepository(ctx.supabase, ctx.userId);
  const { data: ads } = await adsRepo.findAllOrdered();
  const latestAd = (ads ?? [])[0];
  if (latestAd) {
    const { data, error } = await adsRepo.update(latestAd.id, { orcamento_disponivel: orcamento });
    if (error || !data) return { budget: { orcamento: null, source: null, sourceId: null }, error: error ?? "Erro ao salvar." };
    return { budget: { orcamento, source: "ads", sourceId: data.id }, error: null };
  }

  return {
    budget: { orcamento: null, source: null, sourceId: null },
    error: "Crie um plano Money ou campanha Ads para salvar o orçamento.",
  };
}

export function budgetSourceLabel(source: BudgetSource): string {
  if (source === "money") return "Money Missions";
  if (source === "ads") return "Ads Manager";
  if (source === "orchestration") return "Orchestrator";
  if (source === "launch") return "Launch Center";
  return "—";
}
