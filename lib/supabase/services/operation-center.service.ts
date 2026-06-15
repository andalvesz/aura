import { recordSystemLog } from "@/lib/logs/record";
import { OperationCenterRepository } from "@/lib/supabase/repositories/operation-center.repository";
import { saveAuraMemory } from "@/lib/supabase/services/ai-memories.service";
import { getResolvedUserBudget } from "@/lib/supabase/services/campaign-budget.service";
import { prepareLaunch } from "@/lib/supabase/services/campaign-orchestrator.service";
import { getCeoDashboard } from "@/lib/supabase/services/ceo.service";
import { generateCopylab } from "@/lib/supabase/services/copylab.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import { generateStudioAssets } from "@/lib/supabase/services/creative-studio.service";
import { getExecutionDashboard, syncOperationCenterTasks } from "@/lib/supabase/services/execution.service";
import { generateLanding } from "@/lib/supabase/services/landing-builder.service";
import { getKiwifyIntelligence } from "@/lib/supabase/services/kiwify-intelligence.service";
import { getMetaIntelligence } from "@/lib/supabase/services/meta-intelligence.service";
import { getMissionControlState } from "@/lib/supabase/services/mission-control.service";
import {
  generatePerformanceReport,
  getPerformanceDashboard,
} from "@/lib/supabase/services/performance.service";
import { getRevenueDashboard } from "@/lib/supabase/services/revenue.service";
import type {
  AuraCeoSession,
  Json,
  OperationCenter,
  TableInsert,
  TableUpdate,
} from "@/types/database";
import { intakeFromProductBundle as copyIntakeFromBundle } from "@/utils/copylab";
import { rankProductsForLaunch, type CreatorProductBundle } from "@/utils/creator";
import { intakeFromProductBundle as studioIntakeFromBundle } from "@/utils/creative-studio";
import { intakeFromProductBundle as landingIntakeFromBundle } from "@/utils/landing-builder";
import {
  appendExecutiveLog,
  buildMissingForApproval,
  buildOperationCenterAuraContext,
  buildOperationNextSteps,
  buildOperationPerformanceContext,
  computeOperationCenterDashboard,
  computeOperationSteps,
  computeOperationalScore,
  isOperationMutable,
  OPERATION_TERMINAL_ERROR,
  parseExecutiveLogs,
  parseOperationNextSteps,
  resolveContinueOperationAction,
  type OperationCenterDashboard,
  type OperationExecutiveLogEntry,
} from "@/utils/operation-center";
import { isMissingSupabaseTableError } from "@/utils/supabase-errors";
import { getOptionalDataContext } from "./context";

function emptyOperationDashboard(): OperationCenterDashboard {
  return computeOperationCenterDashboard({
    operation: null,
    bundle: null,
    metaConnected: false,
    kiwifyConnected: false,
    hasPerformanceReport: false,
  });
}

function logsAsJson(logs: OperationExecutiveLogEntry[]): Json {
  return logs as unknown as Json;
}

function rejectIfOperationTerminal(operation: OperationCenter): string | null {
  if (!isOperationMutable(operation.status)) {
    return OPERATION_TERMINAL_ERROR;
  }
  return null;
}

function resolveOperationRoiPrevisto(params: {
  session: AuraCeoSession;
  bundle: CreatorProductBundle | null;
}): number | null {
  const scores = [
    params.session.probabilidade_sucesso,
    params.session.score_ia,
    params.bundle?.validation?.nota_final ?? null,
  ].filter((value): value is number => value != null && value > 0);

  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
}

async function syncOperationSideEffects(
  operation: OperationCenter,
  bundle: CreatorProductBundle | null,
  integrations: Awaited<ReturnType<typeof loadIntegrations>>
): Promise<void> {
  const dashboard = computeOperationCenterDashboard({
    operation,
    bundle,
    ...integrations,
  });
  await syncOperationCenterTasks(dashboard);
}

async function loadBundleForOperation(
  operation: OperationCenter
): Promise<CreatorProductBundle | null> {
  const { bundles } = await loadCreatorBundles();
  if (operation.product_id) {
    return bundles.find((b) => b.product.id === operation.product_id) ?? null;
  }
  return rankProductsForLaunch(bundles)[0] ?? null;
}

async function loadIntegrations() {
  const [kiwify, meta, performance] = await Promise.all([
    getKiwifyIntelligence(),
    getMetaIntelligence(),
    getPerformanceDashboard(),
  ]);

  return {
    metaConnected: meta.data?.connected ?? false,
    kiwifyConnected: kiwify.data?.connected ?? false,
    hasPerformanceReport: Boolean(performance.report),
    performanceReportId: performance.report?.id ?? null,
  };
}

type OperationIntegrations = Awaited<ReturnType<typeof loadIntegrations>>;

const DEFAULT_INTEGRATIONS: OperationIntegrations = {
  metaConnected: false,
  kiwifyConnected: false,
  hasPerformanceReport: false,
  performanceReportId: null,
};

async function loadIntegrationsSafely(): Promise<OperationIntegrations> {
  try {
    return await loadIntegrations();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[operation-center] loadIntegrations failed:", message);
    recordSystemLog({
      tipo: "warning",
      modulo: "operation-center",
      mensagem: "Integrações indisponíveis ao sincronizar operação — usando defaults.",
      detalhes: { error: message },
    });
    return DEFAULT_INTEGRATIONS;
  }
}

async function resolveCeoOperationTarget(
  repo: OperationCenterRepository,
  ceoSessionId: string
): Promise<{ operation: OperationCenter | null; mode: "create" | "update" }> {
  const { data: bySession, error: sessionLookupError } =
    await repo.findByCeoSessionId(ceoSessionId);

  if (sessionLookupError) {
    console.warn("[operation-center] findByCeoSessionId failed:", sessionLookupError);
  }

  if (bySession && bySession.status !== "cancelled") {
    console.info("[operation-center] resolveCeoOperationTarget: update by ceo_session_id", {
      ceoSessionId,
      operationId: bySession.id,
    });
    return { operation: bySession, mode: "update" };
  }

  const { data: active, error: activeLookupError } = await repo.findActive();

  if (activeLookupError) {
    console.warn("[operation-center] findActive failed:", activeLookupError);
  }

  if (active && isOperationMutable(active.status)) {
    console.info("[operation-center] resolveCeoOperationTarget: update active operation", {
      ceoSessionId,
      operationId: active.id,
      previousCeoSessionId: active.ceo_session_id,
    });
    return { operation: active, mode: "update" };
  }

  console.info("[operation-center] resolveCeoOperationTarget: create new operation", {
    ceoSessionId,
  });
  return { operation: null, mode: "create" };
}

async function verifyActiveOperation(
  repo: OperationCenterRepository,
  operationId: string
): Promise<{ operation: OperationCenter | null; error: string | null }> {
  const { data, error } = await repo.findById(operationId);
  if (error || !data) {
    return { operation: null, error: error ?? "Operação não encontrada após gravação." };
  }

  const { data: active, error: activeError } = await repo.findActive();
  if (activeError) {
    console.warn("[operation-center] verifyActiveOperation findActive failed:", activeError);
  }

  if (active?.id === operationId) {
    console.info("[operation-center] verifyActiveOperation: active operation confirmed", {
      operationId,
      status: active.status,
    });
    return { operation: active, error: null };
  }

  console.warn("[operation-center] verifyActiveOperation: operation saved but not active", {
    operationId,
    activeOperationId: active?.id ?? null,
    status: data.status,
  });

  return { operation: data, error: null };
}

async function persistOperationUpdate(
  repo: OperationCenterRepository,
  operation: OperationCenter,
  bundle: CreatorProductBundle | null,
  integrations: Awaited<ReturnType<typeof loadIntegrations>>,
  extra: TableUpdate<"operation_center"> = {}
): Promise<{ data: OperationCenter | null; error: string | null }> {
  const steps = computeOperationSteps({
    operation,
    bundle,
    metaConnected: integrations.metaConnected,
    kiwifyConnected: integrations.kiwifyConnected,
    hasPerformanceReport: integrations.hasPerformanceReport,
  });

  const roiPrevisto =
    operation.roi_previsto != null ? Number(operation.roi_previsto) : null;

  const operationalScore = computeOperationalScore({
    steps,
    metaConnected: integrations.metaConnected,
    kiwifyConnected: integrations.kiwifyConnected,
    roiPrevisto,
  });

  const missing = buildMissingForApproval(
    steps,
    {
      metaConnected: integrations.metaConnected,
      kiwifyConnected: integrations.kiwifyConnected,
    },
    operation
  );

  const nextSteps = buildOperationNextSteps(steps, missing);

  const { data, error } = await repo.update(operation.id, {
    steps: steps as unknown as Json,
    operational_score: operationalScore,
    next_steps: nextSteps as unknown as Json,
    ...extra,
  });

  const updated = data as OperationCenter | null;
  if (error || !updated) {
    console.error("[operation-center] persistOperationUpdate failed:", error, {
      operationId: operation.id,
    });
    recordSystemLog({
      tipo: "error",
      modulo: "operation-center",
      mensagem: error ?? "Erro ao persistir steps da operação.",
      detalhes: { operationId: operation.id },
    });
    return { data: null, error: error ?? "Erro ao persistir operação." };
  }

  try {
    await syncOperationSideEffects(updated, bundle, integrations);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[operation-center] syncOperationSideEffects failed:", message, {
      operationId: updated.id,
    });
  }

  console.info("[operation-center] persistOperationUpdate: saved", {
    operationId: updated.id,
    status: updated.status,
    operationalScore,
  });

  return { data: updated, error: null };
}

async function logOperationAction(
  operation: OperationCenter,
  action: string,
  message: string,
  details?: Record<string, unknown>
): Promise<OperationExecutiveLogEntry[]> {
  const logs = appendExecutiveLog(parseExecutiveLogs(operation.executive_logs), action, message, details);

  try {
    await saveAuraMemory({
      module: "execution",
      userMessage: action,
      assistantContent: message,
      metadata: { kind: "operation-center", operationId: operation.id, ...details },
    });
  } catch (err) {
    console.warn("[operation-center] saveAuraMemory failed:", err);
  }

  recordSystemLog({
    tipo: "info",
    modulo: "operation-center",
    mensagem: message,
    detalhes: { operationId: operation.id, action, ...details },
  });

  return logs;
}

export async function getOperationCenterState(): Promise<{
  dashboard: OperationCenterDashboard | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { dashboard: null, error: "Usuário não autenticado." };
  }

  try {
    const repo = new OperationCenterRepository(ctx.supabase, ctx.userId);
    const { data: operation, error: operationError } = await repo.findActive();

    if (operationError) {
      console.warn("[operation-center] getOperationCenterState findActive failed:", operationError);
      return { dashboard: emptyOperationDashboard(), error: null };
    }

    if (!operation) {
      return { dashboard: emptyOperationDashboard(), error: null };
    }

    const integrations = await loadIntegrations();
    const bundle = await loadBundleForOperation(operation);

    await persistOperationUpdate(repo, operation, bundle, integrations);
    const { data: refreshed } = await repo.findById(operation.id);
    const dashboard = computeOperationCenterDashboard({
      operation: refreshed ?? operation,
      bundle,
      ...integrations,
    });
    return { dashboard, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingSupabaseTableError(message)) {
      return { dashboard: emptyOperationDashboard(), error: null };
    }
    console.warn("[operation-center] getOperationCenterState:", message);
    return { dashboard: emptyOperationDashboard(), error: null };
  }
}

export async function getOperationCenterContext(): Promise<{
  context: string;
  error: string | null;
}> {
  const { dashboard, error } = await getOperationCenterState();
  if (error || !dashboard) {
    return { context: "", error: error ?? "Erro ao carregar Operation Center." };
  }
  return { context: buildOperationCenterAuraContext(dashboard), error: null };
}

export async function upsertOperationFromCeo(params: {
  session: AuraCeoSession;
  productId?: string | null;
  productName?: string | null;
}): Promise<{ operation: OperationCenter | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { operation: null, error: "Usuário não autenticado." };

  const repo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.info("[operation-center] upsertOperationFromCeo: start", {
    ceoSessionId: params.session.id,
  });

  let productId = params.productId ?? null;
  let productName = params.productName ?? null;

  if (!productId) {
    const { bundles } = await loadCreatorBundles();
    const ranked = rankProductsForLaunch(bundles);
    if (ranked[0]) {
      productId = ranked[0].product.id;
      productName = ranked[0].product.nome ?? ranked[0].product.nicho ?? null;
    }
  }

  const titulo =
    productName ??
    params.session.resumo_executivo?.slice(0, 80) ??
    "Operação estratégica CEO";

  const previewBundle = productId
    ? (await loadCreatorBundles()).bundles.find((bundle) => bundle.product.id === productId) ?? null
    : null;
  const roiPrevisto = resolveOperationRoiPrevisto({
    session: params.session,
    bundle: previewBundle,
  });

  const basePayload = {
    titulo,
    product_id: productId,
    product_nome: productName,
    ceo_session_id: params.session.id,
    success_chance: params.session.probabilidade_sucesso,
    roi_previsto: roiPrevisto,
    status: "preparing" as const,
    metadata: {
      resumo_executivo: params.session.resumo_executivo,
      prioridades: params.session.prioridades,
      riscos: params.session.riscos,
      oportunidades: params.session.oportunidades,
      plano_acao: params.session.plano_acao,
    },
  };

  const { operation: existing, mode } = await resolveCeoOperationTarget(
    repo,
    params.session.id
  );

  let operation: OperationCenter | null = null;
  const created = mode === "create";

  if (mode === "update" && existing) {
    const { data, error } = await repo.update(existing.id, basePayload);
    if (error || !data) {
      console.error("[operation-center] upsertOperationFromCeo: update failed", {
        ceoSessionId: params.session.id,
        operationId: existing.id,
        error,
      });
      recordSystemLog({
        tipo: "error",
        modulo: "operation-center",
        mensagem: error ?? "Erro ao atualizar operação a partir do CEO.",
        detalhes: { ceoSessionId: params.session.id, operationId: existing.id },
      });
      return { operation: null, error: error ?? "Erro ao atualizar operação." };
    }
    operation = data as OperationCenter;
    console.info("[operation-center] upsertOperationFromCeo: updated", {
      operationId: operation.id,
      ceoSessionId: params.session.id,
    });
  } else {
    await repo.cancelActive();

    const tryCreate = async (payload: typeof basePayload) =>
      repo.create({
        ...payload,
        executive_logs: logsAsJson(
          appendExecutiveLog([], "ceo_plan", "Operação criada a partir do plano CEO.")
        ),
      } as Omit<TableInsert<"operation_center">, "user_id">);

    let { data, error } = await tryCreate(basePayload);

    if ((error || !data) && basePayload.product_id) {
      console.warn("[operation-center] upsertOperationFromCeo: retry create without product_id", {
        ceoSessionId: params.session.id,
        error,
      });
      ({ data, error } = await tryCreate({
        ...basePayload,
        product_id: null,
        product_nome: basePayload.product_nome ?? basePayload.titulo,
      }));
    }

    if (error || !data) {
      console.error("[operation-center] upsertOperationFromCeo: create failed", {
        ceoSessionId: params.session.id,
        error,
      });
      recordSystemLog({
        tipo: "error",
        modulo: "operation-center",
        mensagem: error ?? "Erro ao criar operação a partir do CEO.",
        detalhes: { ceoSessionId: params.session.id },
      });
      return { operation: null, error: error ?? "Erro ao criar operação." };
    }

    operation = data as OperationCenter;
    console.info("[operation-center] upsertOperationFromCeo: created", {
      operationId: operation.id,
      ceoSessionId: params.session.id,
    });
  }

  const integrations = await loadIntegrationsSafely();
  const bundle = await loadBundleForOperation(operation);

  let logs: OperationExecutiveLogEntry[];
  try {
    logs = await logOperationAction(
      operation,
      created ? "create" : "update",
      created
        ? `Operação criada a partir do plano CEO: ${titulo}`
        : `Operação atualizada a partir do plano CEO: ${titulo}`,
      { ceoSessionId: params.session.id, roiPrevisto }
    );
  } catch (err) {
    console.warn("[operation-center] logOperationAction failed:", err);
    logs = appendExecutiveLog(
      parseExecutiveLogs(operation.executive_logs),
      created ? "create" : "update",
      created
        ? `Operação criada a partir do plano CEO: ${titulo}`
        : `Operação atualizada a partir do plano CEO: ${titulo}`,
      { ceoSessionId: params.session.id, roiPrevisto }
    );
  }

  const { data: updated, error: updateError } = await persistOperationUpdate(
    repo,
    { ...operation, executive_logs: logsAsJson(logs) },
    bundle,
    integrations,
    { executive_logs: logsAsJson(logs) }
  );

  const persisted = updated ?? operation;
  const { operation: verified, error: verifyError } = await verifyActiveOperation(
    repo,
    persisted.id
  );

  if (updateError) {
    recordSystemLog({
      tipo: "warning",
      modulo: "operation-center",
      mensagem: `Operação ${created ? "criada" : "atualizada"}, mas steps não sincronizados: ${updateError}`,
      detalhes: { operationId: persisted.id, ceoSessionId: params.session.id },
    });
  }

  if (verifyError || !verified) {
    recordSystemLog({
      tipo: "error",
      modulo: "operation-center",
      mensagem: verifyError ?? "Operação não confirmada após gravação.",
      detalhes: { operationId: persisted.id, ceoSessionId: params.session.id },
    });
    return {
      operation: null,
      error: verifyError ?? "Operação não confirmada após gravação.",
    };
  }

  recordSystemLog({
    tipo: "info",
    modulo: "operation-center",
    mensagem: `Operação ${created ? "criada" : "atualizada"} e ativa no Operation Center.`,
    detalhes: {
      operationId: verified.id,
      ceoSessionId: params.session.id,
      status: verified.status,
      titulo: verified.titulo,
    },
  });

  console.info("[operation-center] upsertOperationFromCeo: complete", {
    operationId: verified.id,
    ceoSessionId: params.session.id,
    mode: created ? "create" : "update",
    status: verified.status,
  });

  return { operation: verified, error: null };
}

export async function generateOperationAssets(
  operationId: string,
  assetType: "creatives" | "landing" | "both" = "both"
): Promise<{ operation: OperationCenter | null; message: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { operation: null, message: "", error: "Usuário não autenticado." };

  const repo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  const { data: operation } = await repo.findById(operationId);
  if (!operation) return { operation: null, message: "", error: "Operação não encontrada." };

  const terminalError = rejectIfOperationTerminal(operation);
  if (terminalError) {
    return { operation: null, message: "", error: terminalError };
  }

  const bundle = await loadBundleForOperation(operation);
  if (!bundle) {
    return { operation: null, message: "", error: "Nenhum produto vinculado à operação." };
  }

  const integrations = await loadIntegrations();
  const updates: TableUpdate<"operation_center"> = { status: "preparing" };
  const messages: string[] = [];

  if (assetType === "creatives" || assetType === "both") {
    const intake = {
      ...studioIntakeFromBundle(bundle),
      product_id: bundle.product.id,
      copylab_id: operation.copylab_id ?? null,
    };
    const { record, error } = await generateStudioAssets(intake, "full");
    if (record) {
      updates.assets_id = record.id;
      messages.push("Criativos gerados.");
    } else if (error) {
      messages.push(`Criativos: ${error}`);
    }
  }

  if (assetType === "landing" || assetType === "both") {
    const intake = {
      ...landingIntakeFromBundle(bundle, "pagina_simples"),
      product_id: bundle.product.id,
      copylab_id: operation.copylab_id ?? null,
    };
    const { record, error } = await generateLanding(intake);
    if (record) {
      updates.landing_id = record.id;
      messages.push("Landing gerada.");
    } else if (error) {
      messages.push(`Landing: ${error}`);
    }
  }

  if (!updates.assets_id && !updates.landing_id) {
    return {
      operation: null,
      message: "",
      error: messages.join(" ") || "Não foi possível gerar os assets.",
    };
  }

  const logs = await logOperationAction(
    operation,
    "generate_assets",
    messages.join(" "),
    { assetType }
  );

  const { data: updated, error } = await persistOperationUpdate(
    repo,
    { ...operation, ...updates, executive_logs: logsAsJson(logs) },
    bundle,
    integrations,
    { ...updates, executive_logs: logsAsJson(logs) }
  );

  return {
    operation: updated,
    message: messages.join(" "),
    error: error ?? null,
  };
}

export async function prepareOperationCampaign(
  operationId: string
): Promise<{ operation: OperationCenter | null; message: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { operation: null, message: "", error: "Usuário não autenticado." };

  const repo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  const { data: operation } = await repo.findById(operationId);
  if (!operation) return { operation: null, message: "", error: "Operação não encontrada." };

  const terminalError = rejectIfOperationTerminal(operation);
  if (terminalError) {
    return { operation: null, message: "", error: terminalError };
  }

  if (!operation.product_id) {
    return { operation: null, message: "", error: "Vincule um produto antes de montar a campanha." };
  }

  const bundle = await loadBundleForOperation(operation);
  if (!bundle) {
    return { operation: null, message: "", error: "Produto não encontrado." };
  }

  const missingArtifacts: string[] = [];
  if (!operation.copylab_id) missingArtifacts.push("Copy");
  if (!operation.assets_id) missingArtifacts.push("Criativos");
  if (!operation.landing_id) missingArtifacts.push("Landing");
  if (missingArtifacts.length > 0) {
    return {
      operation: null,
      message: "",
      error: `Complete as etapas antes de montar a campanha: ${missingArtifacts.join(", ")}.`,
    };
  }

  const { budget } = await getResolvedUserBudget();
  const orcamento = budget.orcamento ?? 500;

  const { orchestration, error: orchError } = await prepareLaunch({
    product_id: operation.product_id,
    orchestration_id: operation.orchestration_id ?? undefined,
    orcamento_disponivel: orcamento,
    copylab_id: operation.copylab_id,
    assets_id: operation.assets_id,
    landing_id: operation.landing_id,
    operation_id: operation.id,
  });

  if (orchError || !orchestration) {
    return {
      operation: null,
      message: "",
      error: orchError ?? "Erro ao montar campanha.",
    };
  }

  if (
    orchestration.copylab_id !== operation.copylab_id ||
    orchestration.asset_id !== operation.assets_id ||
    orchestration.landing_id !== operation.landing_id
  ) {
    return {
      operation: null,
      message: "",
      error: "Campanha não foi montada com os artefatos vinculados à operação.",
    };
  }

  const integrations = await loadIntegrations();
  const logs = await logOperationAction(
    operation,
    "prepare_campaign",
    "Campanha montada em modo seguro (rascunho — sem publicação automática).",
    {
      orchestrationId: orchestration.id,
      copylabId: operation.copylab_id,
      assetsId: operation.assets_id,
      landingId: operation.landing_id,
    }
  );

  const { data: updated, error } = await persistOperationUpdate(
    repo,
    operation,
    bundle,
    integrations,
    {
      status: "preparing",
      orchestration_id: orchestration.id,
      executive_logs: logsAsJson(logs),
    }
  );

  return {
    operation: updated,
    message: "Campanha montada em rascunho (modo seguro).",
    error: error ?? null,
  };
}

export async function generateOperationCopy(
  operationId: string
): Promise<{ operation: OperationCenter | null; message: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { operation: null, message: "", error: "Usuário não autenticado." };

  const repo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  const { data: operation } = await repo.findById(operationId);
  if (!operation) return { operation: null, message: "", error: "Operação não encontrada." };

  const terminalError = rejectIfOperationTerminal(operation);
  if (terminalError) {
    return { operation: null, message: "", error: terminalError };
  }

  const bundle = await loadBundleForOperation(operation);
  if (!bundle) {
    return { operation: null, message: "", error: "Nenhum produto vinculado à operação." };
  }

  if (operation.copylab_id) {
    const integrations = await loadIntegrations();
    const { data: updated, error } = await persistOperationUpdate(
      repo,
      operation,
      bundle,
      integrations
    );
    return {
      operation: updated,
      message: "Copy já vinculada à operação.",
      error: error ?? null,
    };
  }

  const copyIntake = {
    ...copyIntakeFromBundle(bundle),
    product_id: bundle.product.id,
  };
  const { record: copy, error: copyError } = await generateCopylab(copyIntake);
  if (!copy) {
    return {
      operation: null,
      message: "",
      error: copyError ?? "Não foi possível gerar a copy.",
    };
  }

  const integrations = await loadIntegrations();
  const logs = await logOperationAction(
    operation,
    "generate_copy",
    "Copy gerada no CopyLab e vinculada à operação.",
    { copylabId: copy.id }
  );

  const { data: updated, error } = await persistOperationUpdate(
    repo,
    { ...operation, copylab_id: copy.id, executive_logs: logsAsJson(logs) },
    bundle,
    integrations,
    {
      status: "preparing",
      copylab_id: copy.id,
      executive_logs: logsAsJson(logs),
    }
  );

  return {
    operation: updated,
    message: "Copy gerada e vinculada à operação.",
    error: error ?? null,
  };
}

export async function sendOperationToPerformanceAi(
  operationId: string
): Promise<{ operation: OperationCenter | null; message: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { operation: null, message: "", error: "Usuário não autenticado." };

  const repo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  const { data: operation } = await repo.findById(operationId);
  if (!operation) return { operation: null, message: "", error: "Operação não encontrada." };

  const terminalError = rejectIfOperationTerminal(operation);
  if (terminalError) {
    return { operation: null, message: "", error: terminalError };
  }

  const bundle = await loadBundleForOperation(operation);
  const integrations = await loadIntegrations();
  const dashboard = computeOperationCenterDashboard({
    operation,
    bundle,
    ...integrations,
  });
  const { budget } = await getResolvedUserBudget();
  const operationContext = buildOperationPerformanceContext({
    dashboard,
    budget: budget.orcamento ?? null,
    risks: (operation.metadata as Record<string, unknown> | null)?.riscos,
    opportunities: (operation.metadata as Record<string, unknown> | null)?.oportunidades,
  });

  const { report, error: perfError } = await generatePerformanceReport({ operationContext });
  if (perfError || !report) {
    return {
      operation: null,
      message: "",
      error: perfError ?? "Erro ao gerar relatório Performance AI.",
    };
  }

  const logs = await logOperationAction(
    operation,
    "performance_ai",
    "Relatório Performance AI gerado com contexto da operação e vinculado.",
    { reportId: report.id, operationId: operation.id }
  );

  const { data: updated, error } = await persistOperationUpdate(
    repo,
    operation,
    bundle,
    { ...integrations, hasPerformanceReport: true, performanceReportId: report.id },
    {
      performance_report_id: report.id,
      executive_logs: logsAsJson(logs),
    }
  );

  return {
    operation: updated,
    message: "Enviado para Performance AI.",
    error: error ?? null,
  };
}

export async function approveOperation(
  operationId: string
): Promise<{
  operation: OperationCenter | null;
  message: string;
  error: string | null;
  missing: string[];
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { operation: null, message: "", error: "Usuário não autenticado.", missing: [] };
  }

  const repo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  const { data: operation } = await repo.findById(operationId);
  if (!operation) {
    return { operation: null, message: "", error: "Operação não encontrada.", missing: [] };
  }

  if (operation.status === "cancelled") {
    return { operation: null, message: "", error: "Operação cancelada.", missing: [] };
  }

  if (operation.status === "ready" || operation.status === "approved") {
    return {
      operation,
      message: "Operação já aprovada (status Pronta).",
      error: null,
      missing: [],
    };
  }

  const bundle = await loadBundleForOperation(operation);
  const integrations = await loadIntegrations();

  const steps = computeOperationSteps({
    operation,
    bundle,
    ...integrations,
  });

  const missing = buildMissingForApproval(
    steps,
    {
      metaConnected: integrations.metaConnected,
      kiwifyConnected: integrations.kiwifyConnected,
    },
    operation
  );

  if (missing.length > 0) {
    return {
      operation: null,
      message: "",
      error: "Operação ainda não está pronta para aprovação.",
      missing,
    };
  }

  const logs = await logOperationAction(
    operation,
    "approve",
    "Operação aprovada — status alterado para Pronta (ready). Anúncios NÃO publicados automaticamente.",
    { safeMode: true }
  );

  const { data: updated, error } = await persistOperationUpdate(
    repo,
    operation,
    bundle,
    integrations,
    {
      status: "ready",
      executive_logs: logsAsJson(logs),
    }
  );

  return {
    operation: updated,
    message: "Operação aprovada — status Pronta. Nenhum anúncio foi publicado.",
    error: error ?? null,
    missing: [],
  };
}

export async function cancelOperation(
  operationId: string
): Promise<{ operation: OperationCenter | null; message: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { operation: null, message: "", error: "Usuário não autenticado." };

  const repo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  const { data: operation } = await repo.findById(operationId);
  if (!operation) return { operation: null, message: "", error: "Operação não encontrada." };

  const logs = await logOperationAction(
    operation,
    "cancel",
    "Operação cancelada pelo usuário."
  );

  const { data: updated, error } = await repo.update(operationId, {
    status: "cancelled",
    executive_logs: logsAsJson(logs),
  });

  if (updated) {
    const integrations = await loadIntegrations();
    await syncOperationSideEffects(updated as OperationCenter, null, integrations);
  }

  return {
    operation: updated as OperationCenter | null,
    message: "Operação cancelada.",
    error: error ?? null,
  };
}

export async function continueOperation(
  operationId: string
): Promise<{ operation: OperationCenter | null; message: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { operation: null, message: "", error: "Usuário não autenticado." };

  const { dashboard, error: dashError } = await getOperationCenterState();
  if (dashError || !dashboard?.operation || dashboard.operation.id !== operationId) {
    return { operation: null, message: "", error: dashError ?? "Operação não encontrada." };
  }

  const terminalError = rejectIfOperationTerminal(dashboard.operation);
  if (terminalError) {
    return { operation: null, message: "", error: terminalError };
  }

  const next =
    parseOperationNextSteps(dashboard.operation.next_steps)[0] ?? dashboard.nextSteps[0] ?? "";
  const action = resolveContinueOperationAction(next);

  switch (action) {
    case "creatives":
      return generateOperationAssets(operationId, "creatives");
    case "landing":
      return generateOperationAssets(operationId, "landing");
    case "copy":
      return generateOperationCopy(operationId);
    case "campaign":
      return prepareOperationCampaign(operationId);
    case "performance":
      return sendOperationToPerformanceAi(operationId);
    case "approve": {
      const result = await approveOperation(operationId);
      return {
        operation: result.operation,
        message: result.message,
        error: result.error,
      };
    }
    default:
      return {
        operation: dashboard.operation,
        message: next || "Revise os próximos passos no Operation Center.",
        error: null,
      };
  }
}

export async function runOperationCenterCoachAction(
  mode: import("@/utils/operation-center").OperationCenterCoachMode
): Promise<{
  dashboard: OperationCenterDashboard | null;
  actionResult: { message: string; error: string | null };
  error: string | null;
}> {
  const { dashboard, error } = await getOperationCenterState();
  if (error || !dashboard) {
    return { dashboard: null, actionResult: { message: "", error: error ?? "Erro." }, error };
  }

  if (!dashboard.operation) {
    return {
      dashboard,
      actionResult: { message: "", error: "Nenhuma operação ativa." },
      error: null,
    };
  }

  const id = dashboard.operation.id;

  switch (mode) {
    case "op-generate-creatives": {
      const result = await generateOperationAssets(id, "creatives");
      const refreshed = await getOperationCenterState();
      return {
        dashboard: refreshed.dashboard,
        actionResult: { message: result.message, error: result.error },
        error: null,
      };
    }
    case "op-prepare-campaign": {
      const result = await prepareOperationCampaign(id);
      const refreshed = await getOperationCenterState();
      return {
        dashboard: refreshed.dashboard,
        actionResult: { message: result.message, error: result.error },
        error: null,
      };
    }
    case "op-approve": {
      const result = await approveOperation(id);
      const refreshed = await getOperationCenterState();
      return {
        dashboard: refreshed.dashboard,
        actionResult: {
          message: result.message,
          error: result.error ?? (result.missing.length ? `Falta: ${result.missing.join(", ")}` : null),
        },
        error: null,
      };
    }
    case "op-continue": {
      const result = await continueOperation(id);
      const refreshed = await getOperationCenterState();
      return {
        dashboard: refreshed.dashboard,
        actionResult: { message: result.message, error: result.error },
        error: null,
      };
    }
    default:
      return {
        dashboard,
        actionResult: { message: "", error: null },
        error: null,
      };
  }
}

export async function getOperationCenterAggregatedContext(): Promise<string> {
  const [mission, revenue, execution, performance, ceo, opState] = await Promise.all([
    getMissionControlState(),
    getRevenueDashboard(),
    getExecutionDashboard(),
    getPerformanceDashboard(),
    getCeoDashboard(),
    getOperationCenterState(),
  ]);

  return [
    opState.dashboard ? buildOperationCenterAuraContext(opState.dashboard) : "",
    mission.dashboard ? `## MISSION\nMissão: ${mission.dashboard.activeMission?.nome ?? "—"}` : "",
    revenue.dashboard
      ? `## REVENUE\nLucro mês: ${revenue.dashboard.lucro.lucroLiquido.month}`
      : "",
    execution.briefing
      ? `## EXECUTION\n${execution.briefing.conselho_ceo}`
      : "",
    performance.panel
      ? `## PERFORMANCE\nOportunidade: ${performance.panel.maiorOportunidade}`
      : "",
    ceo.session ? `## CEO\n${ceo.session.resumo_executivo?.slice(0, 200) ?? ""}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
