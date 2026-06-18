import { recordSystemLog } from "@/lib/logs/record";
import { ProductFactoryRepository } from "@/lib/supabase/repositories/product-factory.repository";
import { generateCopylab } from "@/lib/supabase/services/copylab.service";
import { getCeoDashboard } from "@/lib/supabase/services/ceo.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import { generateStudioAssets } from "@/lib/supabase/services/creative-studio.service";
import { generateDailyPlan, getExecutionDashboard } from "@/lib/supabase/services/execution.service";
import { getKiwifyIntelligence } from "@/lib/supabase/services/kiwify-intelligence.service";
import { syncKiwifyConnection } from "@/lib/supabase/services/kiwify-connect.service";
import { getMetaIntelligence } from "@/lib/supabase/services/meta-intelligence.service";
import { syncMetaConnection } from "@/lib/supabase/services/meta-connect.service";
import {
  generatePerformanceReport,
  getPerformanceDashboard,
} from "@/lib/supabase/services/performance.service";
import { getRevenueDashboard } from "@/lib/supabase/services/revenue.service";
import { getSmartLaunchDashboard } from "@/lib/supabase/services/smart-launch.service";
import type { ExecutionTask } from "@/types/database";
import { intakeFromProductBundle as copyIntakeFromBundle } from "@/utils/copylab";
import { intakeFromProductBundle as studioIntakeFromBundle } from "@/utils/creative-studio";
import type { DailyBriefing } from "@/utils/execution";
import {
  buildMissionControlAuraContext,
  computeMissionControlDashboard,
  MISSION_CONTROL_SAFE_MODE,
  type MissionActionId,
  type MissionControlDashboard,
} from "@/utils/mission-control";
import { META_READ_ONLY_MODE } from "@/utils/meta-intelligence";
import { getOptionalDataContext } from "./context";

export async function getMissionControlState(): Promise<{
  dashboard: MissionControlDashboard | null;
  tasks: ExecutionTask[];
  briefing: DailyBriefing | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { dashboard: null, tasks: [], briefing: null, error: "Usuário não autenticado." };
  }

  const [
    smartLaunch,
    revenue,
    execution,
    performance,
    ceo,
    kiwify,
    meta,
  ] = await Promise.all([
    getSmartLaunchDashboard(),
    getRevenueDashboard(),
    getExecutionDashboard(),
    getPerformanceDashboard(),
    getCeoDashboard(),
    getKiwifyIntelligence(),
    getMetaIntelligence(),
  ]);

  let factoryStatus: string | null = null;
  const session =
    smartLaunch.sessions.find((s) => s.status === "prepared") ??
    smartLaunch.sessions.find((s) => s.status === "preparing") ??
    smartLaunch.center?.session ??
    null;

  let bundle = smartLaunch.center?.bundle ?? null;
  if (session?.product_id && bundle?.product.id !== session.product_id) {
    const { bundles } = await loadCreatorBundles();
    bundle = bundles.find((b) => b.product.id === session.product_id) ?? null;
  }
  if (session?.factory_id) {
    const factoryRepo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
    const { data: factory } = await factoryRepo.findById(session.factory_id);
    factoryStatus = factory?.status ?? null;
  }

  const dashboard = computeMissionControlDashboard({
    session,
    bundle,
    revenue: revenue.dashboard,
    briefing: execution.briefing,
    panel: performance.panel,
    missaoDoDia: ceo.dashboard?.missaoDoDia,
    projetoPrincipal: ceo.dashboard?.projetoPrincipal,
    factoryStatus,
    kiwifyConnected: kiwify.data?.connected ?? false,
    kiwifyProductsCount: kiwify.data?.products.length ?? 0,
    metaConnected: meta.data?.connected ?? false,
    hasPerformanceReport: !!performance.report,
  });

  return {
    dashboard,
    tasks: execution.tasks ?? [],
    briefing: execution.briefing,
    error:
      smartLaunch.error ??
      revenue.error ??
      execution.error ??
      performance.error ??
      null,
  };
}

export async function getMissionControlContext(): Promise<{ context: string; error: string | null }> {
  const { dashboard, error } = await getMissionControlState();
  if (error || !dashboard) return { context: "", error: error ?? "Erro ao carregar Mission Control." };
  return { context: buildMissionControlAuraContext(dashboard), error: null };
}

export async function runMissionAction(action: MissionActionId): Promise<{
  message: string;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { message: "", error: "Usuário não autenticado." };

  const { decisions } = await import("./aura-decision-engine.service").then((mod) =>
    mod.consultDecisionEngine("mission_control")
  );

  if (decisions) {
    recordSystemLog({
      tipo: "info",
      modulo: "decision-engine",
      mensagem: `Mission Control: ação ${action} com prioridade do Decision Engine`,
      detalhes: {
        module: "mission_control",
        action,
        bestProduct: decisions.bestProduct?.label ?? null,
        bestCampaign: decisions.bestCampaign?.label ?? null,
        confidence: decisions.confidence,
      },
    });
  }

  if (!MISSION_CONTROL_SAFE_MODE) {
    return { message: "", error: "Modo seguro desativado — ação bloqueada." };
  }

  switch (action) {
    case "sync_kiwify": {
      const result = await syncKiwifyConnection();
      return {
        message: result.error ? "Sync Kiwify com avisos." : "Kiwify sincronizado.",
        error: result.error,
      };
    }

    case "sync_meta": {
      if (!META_READ_ONLY_MODE) {
        return { message: "", error: "Sync Meta indisponível fora do modo somente leitura." };
      }
      const result = await syncMetaConnection();
      return {
        message: result.error ? "Sync Meta com avisos." : "Meta sincronizado (somente leitura).",
        error: result.error,
      };
    }

    case "update_performance": {
      const { error } = await generatePerformanceReport();
      return {
        message: error ? "Performance atualizada com avisos." : "Performance AI atualizada.",
        error,
      };
    }

    case "generate_daily_advice": {
      const { error } = await generateDailyPlan();
      return {
        message: error ? "Conselho gerado com avisos." : "Conselho diário CEO gerado.",
        error,
      };
    }

    case "generate_copy":
    case "generate_creative": {
      const { center } = await getSmartLaunchDashboard();
      const bundle = center?.bundle;
      if (!bundle) {
        return { message: "", error: "Nenhuma missão ativa com produto vinculado." };
      }

      if (action === "generate_copy") {
        const intake = {
          ...copyIntakeFromBundle(bundle),
          product_id: bundle.product.id,
        };
        const { record, error } = await generateCopylab(intake);
        if (error || !record) {
          return { message: "", error: error ?? "Erro ao gerar copy." };
        }
        return { message: "Nova copy gerada em rascunho.", error: null };
      }

      const intake = {
        ...studioIntakeFromBundle(bundle),
        product_id: bundle.product.id,
        copylab_id: center?.session?.copylab_id ?? null,
      };
      const { record, error } = await generateStudioAssets(intake, "full");
      if (error || !record) {
        return { message: "", error: error ?? "Erro ao gerar criativo." };
      }
      return { message: "Novo criativo gerado em rascunho.", error: null };
    }

    default:
      return { message: "", error: "Ação desconhecida." };
  }
}
