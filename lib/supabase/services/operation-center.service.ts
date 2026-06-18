import { recordSystemLog } from "@/lib/logs/record";
import { CreatorProductsRepository } from "@/lib/supabase/repositories/creator.repository";
import { CreativeAssetsRepository } from "@/lib/supabase/repositories/creative-factory.repository";
import { LandingPagesRepository } from "@/lib/supabase/repositories/landing-factory.repository";
import { OperationCenterRepository } from "@/lib/supabase/repositories/operation-center.repository";
import { saveAuraMemory } from "@/lib/supabase/services/ai-memories.service";
import { getResolvedUserBudget } from "@/lib/supabase/services/campaign-budget.service";
import { prepareLaunch } from "@/lib/supabase/services/campaign-orchestrator.service";
import { getCeoDashboard } from "@/lib/supabase/services/ceo.service";
import { generateCopylab } from "@/lib/supabase/services/copylab.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import { getExecutionDashboard, syncOperationCenterTasks } from "@/lib/supabase/services/execution.service";
import {
  generateLandingPage,
} from "@/lib/supabase/services/landing-factory.service";
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
  KiwifyProduct,
  OperationCenter,
  TableInsert,
  TableUpdate,
} from "@/types/database";
import type { CeoOpportunityRadar } from "@/utils/ceo";
import {
  intakeFromProductBundle as copyIntakeFromBundle,
  intakeFromProductName,
  type CopylabIntake,
} from "@/utils/copylab";
import { rankProductsForLaunch, type CreatorProductBundle } from "@/utils/creator";
import { mergeCreativeFactoryMetadata } from "@/utils/creative-factory";
import { readCreativeDirectorMetadata } from "@/utils/creative-director";
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
  resolveCeoOperationCommand,
  resolveContinueOperationAction,
  resolveNextExecutableOperationAction,
  selectOperationActionFromDecisionEngine,
  type CeoOperationCommand,
  type OperationCenterDashboard,
  type OperationExecutiveLogEntry,
} from "@/utils/operation-center";
import {
  matchKiwifyProductByHints,
  pickTopKiwifyCatalogProduct,
  resolveOperationProductName,
  type OperationProductSource,
} from "@/utils/operation-product";
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

type ResolvedOperationProduct = {
  productId: string | null;
  productName: string | null;
  source: OperationProductSource | "none";
  kiwifyProductId: string | null;
};

function readOperationMetadata(operation: OperationCenter): Record<string, unknown> {
  if (!operation.metadata || typeof operation.metadata !== "object" || Array.isArray(operation.metadata)) {
    return {};
  }
  return operation.metadata as Record<string, unknown>;
}

async function ensureCreatorProductFromKiwify(
  kiwifyProduct: KiwifyProduct,
  session?: AuraCeoSession | null
): Promise<{ productId: string; productName: string } | null> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return null;

  const { bundles } = await loadCreatorBundles();
  const existing = bundles.find(
    (bundle) => bundle.product.nome?.trim().toLowerCase() === kiwifyProduct.name.trim().toLowerCase()
  );
  if (existing?.product.id) {
    return {
      productId: existing.product.id,
      productName: existing.product.nome ?? kiwifyProduct.name,
    };
  }

  const price = kiwifyProduct.price_cents ? kiwifyProduct.price_cents / 100 : 197;
  const productsRepo = new CreatorProductsRepository(ctx.supabase, ctx.userId);
  const { data: product, error } = await productsRepo.create({
    status: "validacao",
    nome: kiwifyProduct.name,
    nicho: "Kiwify",
    promessa: kiwifyProduct.name,
    problema: session?.resumo_executivo?.slice(0, 240) ?? "Produto importado da Kiwify para operação CEO.",
    solucao: session?.plano_acao?.slice(0, 240) ?? "Executar campanha com base no plano estratégico CEO.",
    avatar: "Cliente ideal do produto Kiwify",
    publico_alvo: "Público comprador do produto digital",
    faixa_preco_min: price,
    faixa_preco_max: price,
    probabilidade_venda: kiwifyProduct.affiliate_score ?? 65,
    investimento_previsto: null,
    receita_prevista: null,
    roi_estimado: null,
    used_aura_data: true,
    target_country: "BR",
    target_language: "pt-BR",
    currency: kiwifyProduct.currency || "BRL",
  } satisfies Omit<TableInsert<"creator_products">, "user_id">);

  if (error || !product) {
    console.error("[operation] ensureCreatorProductFromKiwify failed", {
      kiwifyProductId: kiwifyProduct.id,
      error,
    });
    return null;
  }

  console.info("[operation] product persisted", {
    source: "kiwify_synced",
    productId: product.id,
    productName: product.nome,
    kiwifyProductId: kiwifyProduct.id,
  });

  return {
    productId: product.id,
    productName: product.nome ?? kiwifyProduct.name,
  };
}

async function resolveOperationProductForCeo(params: {
  explicitProductId?: string | null;
  explicitProductName?: string | null;
  session?: AuraCeoSession | null;
  radar?: CeoOpportunityRadar | null;
  pergunta?: string | null;
  resumoExecutivo?: string | null;
  planoAcao?: string | null;
}): Promise<ResolvedOperationProduct> {
  const { bundles } = await loadCreatorBundles();

  if (params.explicitProductId) {
    const linked = bundles.find((bundle) => bundle.product.id === params.explicitProductId);
    if (linked) {
      return {
        productId: linked.product.id,
        productName: params.explicitProductName ?? linked.product.nome ?? linked.product.nicho ?? null,
        source: "creator",
        kiwifyProductId: null,
      };
    }

    return {
      productId: params.explicitProductId,
      productName: params.explicitProductName ?? null,
      source: "none",
      kiwifyProductId: null,
    };
  }

  const { decision } = await import("./aura-decision-engine.service").then((mod) =>
    mod.resolveBestProduct()
  );
  if (decision?.label) {
    console.info("[decision-engine] operation product candidate", {
      label: decision.label,
      source: decision.source,
      score: decision.score,
    });
    const matchedBundle = bundles.find(
      (b) =>
        b.product.nome === decision.label ||
        b.product.nicho === decision.label ||
        (b.product.nome != null && decision.label.includes(b.product.nome))
    );
    if (matchedBundle) {
      return {
        productId: matchedBundle.product.id,
        productName:
          matchedBundle.product.nome ?? matchedBundle.product.nicho ?? decision.label,
        source: "creator",
        kiwifyProductId: null,
      };
    }
  }

  const ranked = rankProductsForLaunch(bundles);
  if (ranked[0]) {
    return {
      productId: ranked[0].product.id,
      productName: ranked[0].product.nome ?? ranked[0].product.nicho ?? null,
      source: "creator",
      kiwifyProductId: null,
    };
  }

  const kiwify = await getKiwifyIntelligence();
  if (!kiwify.data?.connected || kiwify.data.products.length === 0) {
    return {
      productId: null,
      productName: params.explicitProductName ?? null,
      source: "none",
      kiwifyProductId: null,
    };
  }

  const hints = [
    params.radar?.melhorOportunidade.titulo,
    params.radar?.maisLucrativo.titulo,
    params.radar?.maisRapido.titulo,
    params.pergunta,
    params.session?.pergunta,
    params.session?.resumo_executivo,
    params.resumoExecutivo,
    params.planoAcao,
    params.explicitProductName,
  ].filter((hint): hint is string => Boolean(hint?.trim()));

  const matched =
    matchKiwifyProductByHints(kiwify.data.products, hints) ??
    pickTopKiwifyCatalogProduct(
      kiwify.data.products,
      kiwify.data.metrics.topSellingProducts.map((product) => product.name)
    );

  if (!matched) {
    return {
      productId: null,
      productName: params.explicitProductName ?? null,
      source: "none",
      kiwifyProductId: null,
    };
  }

  const synced = await ensureCreatorProductFromKiwify(matched, params.session);
  if (!synced) {
    return {
      productId: null,
      productName: matched.name,
      source: "kiwify",
      kiwifyProductId: matched.id,
    };
  }

  console.info("[operation] product selected", {
    source: "kiwify_synced",
    productId: synced.productId,
    productName: synced.productName,
    kiwifyProductId: matched.id,
  });

  return {
    productId: synced.productId,
    productName: synced.productName,
    source: "kiwify_synced",
    kiwifyProductId: matched.id,
  };
}

async function ensureOperationProductLinked(
  repo: OperationCenterRepository,
  operation: OperationCenter,
  hints?: {
    session?: AuraCeoSession | null;
    radar?: CeoOpportunityRadar | null;
    pergunta?: string | null;
  }
): Promise<OperationCenter> {
  const bundle = await loadBundleForOperation(operation);
  if (
    operation.product_id &&
    operation.product_nome &&
    bundle &&
    bundle.product.id === operation.product_id
  ) {
    return operation;
  }

  const metadata = readOperationMetadata(operation);
  const resolved = await resolveOperationProductForCeo({
    explicitProductId: operation.product_id,
    explicitProductName: operation.product_nome,
    session: hints?.session ?? null,
    radar: hints?.radar ?? null,
    pergunta: hints?.pergunta ?? (typeof metadata.pergunta === "string" ? metadata.pergunta : null),
    resumoExecutivo:
      typeof metadata.resumo_executivo === "string" ? metadata.resumo_executivo : null,
    planoAcao: typeof metadata.plano_acao === "string" ? metadata.plano_acao : null,
  });

  if (!resolved.productId) {
    console.warn("[operation] product selected: none", {
      operationId: operation.id,
      productName: resolved.productName,
      source: resolved.source,
    });
    return operation;
  }

  if (
    resolved.source === "none" &&
    operation.product_id === resolved.productId &&
    operation.product_nome?.trim()
  ) {
    return operation;
  }

  const { data: updated, error } = await repo.update(operation.id, {
    product_id: resolved.productId,
    product_nome: resolved.productName ?? operation.product_nome,
    metadata: {
      ...metadata,
      product_source: resolved.source,
      kiwify_product_id: resolved.kiwifyProductId,
    } as Json,
  });

  if (error || !updated) {
    console.error("[operation] operation updated failed", {
      operationId: operation.id,
      productId: resolved.productId,
      error,
    });
    return operation;
  }

  console.info("[operation] operation updated", {
    operationId: updated.id,
    productId: updated.product_id,
    productName: updated.product_nome,
    source: resolved.source,
  });

  return updated as OperationCenter;
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
  repo: OperationCenterRepository
): Promise<{ operation: OperationCenter | null; mode: "create" | "update" }> {
  const { data: active, error: activeLookupError } = await repo.findActive();

  if (activeLookupError) {
    console.warn("[operation-center] findActive failed:", activeLookupError);
  }

  if (active && isOperationMutable(active.status)) {
    console.info("[operation-center] resolveCeoOperationTarget: update active operation", {
      operationId: active.id,
    });
    return { operation: active, mode: "update" };
  }

  console.info("[operation-center] resolveCeoOperationTarget: create new operation");
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

async function loadCreativeFactoryAssetsFlag(
  operationId: string | null | undefined
): Promise<boolean> {
  if (!operationId) return false;
  const ctx = await getOptionalDataContext();
  if (!ctx) return false;
  const repo = new CreativeAssetsRepository(ctx.supabase, ctx.userId);
  const { count } = await repo.countByOperationId(operationId);
  return count > 0;
}

async function loadLandingPageSummary(
  landingId: string | null
): Promise<OperationCenterDashboard["landingPage"]> {
  if (!landingId) return null;

  const ctx = await getOptionalDataContext();
  if (!ctx) return null;

  const repo = new LandingPagesRepository(ctx.supabase, ctx.userId);
  const { data } = await repo.findById(landingId);
  if (!data) return null;

  return {
    id: data.id,
    slug: data.slug,
    status: data.status,
    previewUrl: data.preview_url,
    publishedUrl: data.published_url,
    title: data.title,
  };
}

async function persistOperationUpdate(
  repo: OperationCenterRepository,
  operation: OperationCenter,
  bundle: CreatorProductBundle | null,
  integrations: Awaited<ReturnType<typeof loadIntegrations>>,
  extra: TableUpdate<"operation_center"> = {}
): Promise<{ data: OperationCenter | null; error: string | null }> {
  const hasCreativeFactoryAssets = await loadCreativeFactoryAssetsFlag(operation.id);

  const steps = computeOperationSteps({
    operation,
    bundle,
    metaConnected: integrations.metaConnected,
    kiwifyConnected: integrations.kiwifyConnected,
    hasPerformanceReport: integrations.hasPerformanceReport,
    hasCreativeFactoryAssets,
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
    operation,
    hasCreativeFactoryAssets
  );

  const nextSteps = buildOperationNextSteps(steps, missing);

  const { data, error } = await repo.update(operation.id, {
    steps: steps as unknown as Json,
    operational_score: operationalScore,
    next_steps: nextSteps as unknown as Json,
    ...extra,
  });

  const updated = data as OperationCenter | null;

  console.info("[operation] operation updated", {
    operationId: operation.id,
    productId: updated?.product_id ?? operation.product_id,
    productName: updated?.product_nome ?? operation.product_nome,
    copy: steps.copy,
    operationalScore,
  });

  console.info("[ceo-operation] steps recomputed", {
    operationId: operation.id,
    copy: steps.copy,
    copylabId: (extra.copylab_id as string | undefined) ?? operation.copylab_id,
    operationalScore,
  });

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

async function loadCreativeGeneratedAssetsForOperation(
  operation: OperationCenter
): Promise<import("@/utils/creative-generated-assets").CreativeGeneratedAssetSummary[]> {
  const director = readCreativeDirectorMetadata(operation.metadata);
  const ctx = await getOptionalDataContext();
  if (!ctx) return [];

  const { CreativeGeneratedAssetsRepository } = await import(
    "@/lib/supabase/repositories/creative-generated-assets.repository"
  );
  const { toCreativeGeneratedAssetSummary } = await import("@/utils/creative-generated-assets");

  const repo = new CreativeGeneratedAssetsRepository(ctx.supabase, ctx.userId);
  const generatedIds = director?.generated_asset_ids ?? [];
  const { data } =
    generatedIds.length > 0
      ? await repo.findByIds(generatedIds)
      : await repo.findByOperationId(operation.id);

  return (data ?? []).map(toCreativeGeneratedAssetSummary);
}

async function buildOperationCenterDashboardFromOperation(
  operation: OperationCenter
): Promise<OperationCenterDashboard> {
  const integrations = await loadIntegrations();
  const bundle = await loadBundleForOperation(operation);
  const hasCreativeFactoryAssets = await loadCreativeFactoryAssetsFlag(operation.id);
  const landingPage = await loadLandingPageSummary(operation.landing_id);
  const creativeGeneratedAssets = await loadCreativeGeneratedAssetsForOperation(operation);
  return computeOperationCenterDashboard({
    operation,
    bundle,
    ...integrations,
    hasCreativeFactoryAssets,
    landingPage,
    creativeGeneratedAssets,
  });
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

    const dashboard = await buildOperationCenterDashboardFromOperation(operation);
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

export async function syncOperationCenterState(): Promise<{
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
      return { dashboard: null, error: operationError };
    }

    if (!operation) {
      return { dashboard: emptyOperationDashboard(), error: null };
    }

    const metadata = readOperationMetadata(operation);
    const linkedOperation = await ensureOperationProductLinked(repo, operation, {
      pergunta: typeof metadata.pergunta === "string" ? metadata.pergunta : null,
    });

    const integrations = await loadIntegrations();
    const bundle = await loadBundleForOperation(linkedOperation);

    await persistOperationUpdate(repo, linkedOperation, bundle, integrations);
    const { data: refreshed } = await repo.findById(linkedOperation.id);
    const finalOperation = refreshed ?? linkedOperation;
    const dashboard = await buildOperationCenterDashboardFromOperation(finalOperation);
    return { dashboard, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingSupabaseTableError(message)) {
      return { dashboard: emptyOperationDashboard(), error: null };
    }
    return { dashboard: null, error: message };
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
  radar?: CeoOpportunityRadar | null;
  pergunta?: string | null;
}): Promise<{ operation: OperationCenter | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { operation: null, error: "Usuário não autenticado." };

  const repo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  console.info("[operation-center] upsertOperationFromCeo: start", {
    ceoSessionId: params.session.id,
  });

  const resolved = await resolveOperationProductForCeo({
    explicitProductId: params.productId ?? null,
    explicitProductName: params.productName ?? null,
    session: params.session,
    radar: params.radar ?? null,
    pergunta: params.pergunta ?? null,
  });

  const productId = resolved.productId;
  const productName = resolved.productName;

  console.info("[operation] product selected", {
    ceoSessionId: params.session.id,
    productId,
    productName,
    source: resolved.source,
    kiwifyProductId: resolved.kiwifyProductId,
  });

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

  const operationFields = {
    titulo,
    product_id: productId,
    product_nome: productName,
    success_chance: params.session.probabilidade_sucesso,
    roi_previsto: roiPrevisto,
    status: "preparing" as const,
    metadata: {
      ceo_session_id: params.session.id,
      pergunta: params.pergunta ?? params.session.pergunta,
      product_source: resolved.source,
      kiwify_product_id: resolved.kiwifyProductId,
      resumo_executivo: params.session.resumo_executivo,
      prioridades: params.session.prioridades,
      riscos: params.session.riscos,
      oportunidades: params.session.oportunidades,
      plano_acao: params.session.plano_acao,
    },
  };

  const { operation: existing, mode } = await resolveCeoOperationTarget(repo);

  let operation: OperationCenter | null = null;
  const created = mode === "create";

  if (mode === "update" && existing) {
    const { data, error } = await repo.update(existing.id, {
      ...operationFields,
      ceo_session_id: params.session.id,
    });
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
    console.info("[operation] product persisted", {
      operationId: operation.id,
      productId: operation.product_id,
      productName: operation.product_nome,
      mode: "update",
    });
    console.info("[operation-center] upsertOperationFromCeo: updated", {
      operationId: operation.id,
      ceoSessionId: params.session.id,
    });
  } else {
    await repo.cancelActive();

    const tryCreate = async (payload: typeof operationFields) =>
      repo.create({
        ...payload,
        executive_logs: logsAsJson(
          appendExecutiveLog([], "ceo_plan", "Operação criada a partir do plano CEO.")
        ),
      } as Omit<TableInsert<"operation_center">, "user_id">);

    const { data, error } = await tryCreate(operationFields);

    if (error || !data) {
      console.error("[operation-center] upsertOperationFromCeo: create failed", {
        ceoSessionId: params.session.id,
        productId: operationFields.product_id,
        error,
      });
      recordSystemLog({
        tipo: "error",
        modulo: "operation-center",
        mensagem: error ?? "Erro ao criar operação a partir do CEO.",
        detalhes: {
          ceoSessionId: params.session.id,
          productId: operationFields.product_id,
        },
      });
      return { operation: null, error: error ?? "Erro ao criar operação." };
    }

    operation = data as OperationCenter;
    console.info("[operation] product persisted", {
      operationId: operation.id,
      productId: operation.product_id,
      productName: operation.product_nome,
      mode: "create",
    });
    await repo.tryLinkCeoSession(operation.id, params.session.id);
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

export async function linkCreativeFactoryAssetToOperation(
  operationId: string,
  asset: { id: string; asset_type: string; title: string | null }
): Promise<{ operation: OperationCenter | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { operation: null, error: "Usuário não autenticado." };

  const repo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  const { data: operation } = await repo.findById(operationId);
  if (!operation) return { operation: null, error: "Operação não encontrada." };

  if (!isOperationMutable(operation.status)) {
    return { operation: null, error: null };
  }

  const mergedMetadata = mergeCreativeFactoryMetadata(operation.metadata, asset.id);
  const logs = await logOperationAction(
    operation,
    "creative_factory",
    `Criativo ${asset.asset_type} gerado: ${asset.title ?? asset.id}.`,
    { assetId: asset.id, assetType: asset.asset_type }
  );

  const integrations = await loadIntegrationsSafely();
  const bundle = await loadBundleForOperation(operation);

  const { data: updated, error } = await persistOperationUpdate(
    repo,
    {
      ...operation,
      metadata: {
        ...mergedMetadata,
        creative_factory_asset_ref: asset.id,
      } as Json,
      executive_logs: logsAsJson(logs),
    },
    bundle,
    integrations,
    {
      metadata: {
        ...mergedMetadata,
        creative_factory_asset_ref: asset.id,
      } as Json,
      executive_logs: logsAsJson(logs),
      status: "preparing",
    }
  );

  return { operation: updated, error: error ?? null };
}

export async function linkLandingFactoryToOperation(
  operationId: string,
  landing: { id: string; title: string | null; slug: string }
): Promise<{ operation: OperationCenter | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { operation: null, error: "Usuário não autenticado." };

  const repo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  const { data: operation } = await repo.findById(operationId);
  if (!operation) return { operation: null, error: "Operação não encontrada." };

  if (!isOperationMutable(operation.status)) {
    return { operation: null, error: null };
  }

  const logs = await logOperationAction(
    operation,
    "landing_factory",
    `Landing real gerada: ${landing.title ?? landing.slug}.`,
    { landingId: landing.id, slug: landing.slug }
  );

  const integrations = await loadIntegrationsSafely();
  const bundle = await loadBundleForOperation(operation);

  const { data: updated, error } = await persistOperationUpdate(
    repo,
    {
      ...operation,
      landing_id: landing.id,
      executive_logs: logsAsJson(logs),
    },
    bundle,
    integrations,
    {
      landing_id: landing.id,
      executive_logs: logsAsJson(logs),
      status: "preparing",
    }
  );

  return { operation: updated, error: error ?? null };
}

export async function generateOperationLandingPage(operationId: string): Promise<{
  operation: OperationCenter | null;
  message: string;
  error: string | null;
}> {
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

  const { page, error: genError } = await generateLandingPage({
    ...landingIntakeFromBundle(bundle, "pagina_simples"),
    operation_id: operationId,
    product_id: bundle.product.id,
    copylab_id: operation.copylab_id ?? null,
    titulo: bundle.product.nome ?? undefined,
    promessa: bundle.product.promessa ?? undefined,
    avatar: bundle.product.avatar ?? undefined,
    problema: bundle.product.problema ?? undefined,
    solucao: bundle.product.solucao ?? undefined,
  });

  if (!page) {
    return { operation: null, message: "", error: genError ?? "Não foi possível gerar a landing." };
  }

  const sync = await linkLandingFactoryToOperation(operationId, {
    id: page.id,
    title: page.title,
    slug: page.slug,
  });

  return {
    operation: sync.operation,
    message: `Landing real gerada em rascunho. Preview: ${page.preview_url ?? page.slug}`,
    error: sync.error,
  };
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

  if (assetType === "landing") {
    return generateOperationLandingPage(operationId);
  }

  if (assetType === "creatives") {
    const { generateCreativePackage } = await import(
      "@/lib/supabase/services/creative-director.service"
    );
    const result = await generateCreativePackage(operationId);
    if (!result.operation) {
      return {
        operation: null,
        message: "",
        error: result.error ?? "Não foi possível gerar criativos reais.",
      };
    }

    const logs = await logOperationAction(
      operation,
      "generate_assets",
      result.message,
      { assetType: "creatives" }
    );
    await repo.update(operation.id, {
      executive_logs: logsAsJson(logs),
      status: operation.status === "draft" ? "preparing" : operation.status,
    });

    return {
      operation: result.operation,
      message: result.message,
      error: result.error,
    };
  }

  const bundle = await loadBundleForOperation(operation);
  if (!bundle) {
    return { operation: null, message: "", error: "Nenhum produto vinculado à operação." };
  }

  const integrations = await loadIntegrations();
  const updates: TableUpdate<"operation_center"> = { status: "preparing" };
  const messages: string[] = [];

  if (assetType === "both") {
    const { generateCreativePackage } = await import(
      "@/lib/supabase/services/creative-director.service"
    );
    const creativeResult = await generateCreativePackage(operationId);
    if (creativeResult.operation) {
      messages.push(creativeResult.message || "Criativos reais gerados.");
    } else if (creativeResult.error) {
      messages.push(`Criativos: ${creativeResult.error}`);
    }

    const landingResult = await generateOperationLandingPage(operationId);
    if (landingResult.operation) {
      updates.landing_id = landingResult.operation.landing_id;
      messages.push("Landing real gerada.");
    } else if (landingResult.error) {
      messages.push(`Landing: ${landingResult.error}`);
    }
  }

  if (messages.length === 0) {
    return {
      operation: null,
      message: "",
      error: "Não foi possível gerar os assets.",
    };
  }

  if (!updates.landing_id && messages.some((m) => m.startsWith("Criativos:"))) {
    return {
      operation: null,
      message: "",
      error: messages.join(" "),
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
  console.info("[ceo-operation] generate copy started", { operationId });

  const ctx = await getOptionalDataContext();
  if (!ctx) return { operation: null, message: "", error: "Usuário não autenticado." };

  const repo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  let { data: operation } = await repo.findById(operationId);
  if (!operation) return { operation: null, message: "", error: "Operação não encontrada." };

  console.info("[copy] operation id", operation.id);
  console.info("[copy] product_id", operation.product_id);
  console.info("[copy] product_nome", operation.product_nome);

  const metadata = readOperationMetadata(operation);
  operation = await ensureOperationProductLinked(repo, operation, {
    pergunta: typeof metadata.pergunta === "string" ? metadata.pergunta : null,
  });

  const terminalError = rejectIfOperationTerminal(operation);
  if (terminalError) {
    return { operation: null, message: "", error: terminalError };
  }

  const bundle = await loadBundleForOperation(operation);
  const fallbackProductName = resolveOperationProductName(operation, metadata);

  let copyIntake: CopylabIntake;
  if (bundle) {
    copyIntake = {
      ...copyIntakeFromBundle(bundle),
      product_id: bundle.product.id,
    };
  } else if (fallbackProductName) {
    console.info("[copy] fallback product name used", fallbackProductName);
    copyIntake = intakeFromProductName(fallbackProductName, {
      productId: operation.product_id,
      problema:
        typeof metadata.resumo_executivo === "string" ? metadata.resumo_executivo : null,
      solucao: typeof metadata.plano_acao === "string" ? metadata.plano_acao : null,
    });
  } else {
    return { operation: null, message: "", error: "Nenhum produto vinculado à operação." };
  }

  if (operation.copylab_id) {
    console.info("[ceo-operation] copylab_id already set", {
      operationId,
      copylabId: operation.copylab_id,
    });
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

  const { record: copy, error: copyError } = await generateCopylab(copyIntake);
  if (!copy) {
    console.error("[ceo-operation] generate copy failed", { operationId, copyError });
    return {
      operation: null,
      message: "",
      error: copyError ?? "Não foi possível gerar a copy.",
    };
  }

  console.info("[ceo-operation] copylab_id saved", {
    operationId,
    copylabId: copy.id,
  });

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
  const hasCreativeFactoryAssets = await loadCreativeFactoryAssetsFlag(operation.id);

  const steps = computeOperationSteps({
    operation,
    bundle,
    ...integrations,
    hasCreativeFactoryAssets,
  });

  const missing = buildMissingForApproval(
    steps,
    {
      metaConnected: integrations.metaConnected,
      kiwifyConnected: integrations.kiwifyConnected,
    },
    operation,
    hasCreativeFactoryAssets
  );

  if (missing.length > 0) {
    return {
      operation: null,
      message: "",
      error: "Operação ainda não está pronta para aprovação.",
      missing,
    };
  }

  const { requireMultipleExcellenceDeliveries } = await import("./excellence-integration.service");
  const { collectOperationAssetChecks } = await import("@/utils/specialist-engine");
  const specialistGate = await requireMultipleExcellenceDeliveries(
    collectOperationAssetChecks(operation),
    { module: "operation-center" }
  );
  if (!specialistGate.allowed) {
    return {
      operation: null,
      message: "",
      error: specialistGate.error ?? "Operação bloqueada pelo Aura Excellence Engine.",
      missing: ["specialist_approval"],
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

  if (updated) {
    void import("./growth-brain.service")
      .then(({ feedGrowthBrainFromOperation }) =>
        feedGrowthBrainFromOperation({
          operationId: updated.id,
          productId: updated.product_id,
          productName: updated.product_nome,
          copyId: updated.copylab_id,
          creativeId: updated.assets_id,
          landingId: updated.landing_id,
          campaignId: updated.orchestration_id,
          operationalScore: updated.operational_score,
          roiPrevisto: updated.roi_previsto != null ? Number(updated.roi_previsto) : null,
        })
      )
      .catch(() => undefined);

    void import("./revenue-ai.service")
      .then(({ feedRevenueAiFromOperation }) =>
        feedRevenueAiFromOperation({
          operationId: updated.id,
          productId: updated.product_id,
          productName: updated.product_nome,
          roiPrevisto: updated.roi_previsto != null ? Number(updated.roi_previsto) : null,
        })
      )
      .catch(() => undefined);

    if (updated.product_nome) {
      void import("./market-hunter.service")
        .then(({ feedMarketHunterFromOperation }) =>
          feedMarketHunterFromOperation({
            productName: updated.product_nome!,
            operationId: updated.id,
            operationalScore: updated.operational_score,
            roiPrevisto: updated.roi_previsto != null ? Number(updated.roi_previsto) : null,
          })
        )
        .catch(() => undefined);
    }
  }

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
    console.warn("[ceo-operation] continueOperation: active operation not found", {
      operationId,
      dashError,
      activeOperationId: dashboard?.operation?.id ?? null,
    });
    return { operation: null, message: "", error: dashError ?? "Operação não encontrada." };
  }

  console.info("[ceo-operation] active operation id", {
    operationId: dashboard.operation.id,
    titulo: dashboard.operation.titulo,
  });

  const terminalError = rejectIfOperationTerminal(dashboard.operation);
  if (terminalError) {
    return { operation: null, message: "", error: terminalError };
  }

  const nextFromSteps =
    parseOperationNextSteps(dashboard.operation.next_steps)[0] ?? dashboard.nextSteps[0] ?? "";

  const { decisions } = await import("./aura-decision-engine.service").then((mod) =>
    mod.consultDecisionEngine("operation_center")
  );
  console.info("[decision-engine] operation next step context", {
    operationId,
    bestCreative: decisions?.bestCreative?.label ?? null,
    bestLanding: decisions?.bestLanding?.label ?? null,
    bestCampaign: decisions?.bestCampaign?.label ?? null,
    nextFromSteps,
  });

  const decisionAction = selectOperationActionFromDecisionEngine({
    progress: dashboard.progress,
    nextSteps: dashboard.nextSteps,
    missingForApproval: dashboard.missingForApproval,
    decisions,
  });

  const executableAction = decisionAction;

  if (decisionAction) {
    console.info("[decision-engine] next action selected", {
      operationId,
      action: decisionAction,
      bestProduct: decisions?.bestProduct?.label ?? null,
      bestCreative: decisions?.bestCreative?.label ?? null,
      bestLanding: decisions?.bestLanding?.label ?? null,
      bestCampaign: decisions?.bestCampaign?.label ?? null,
    });
    recordSystemLog({
      tipo: "info",
      modulo: "decision-engine",
      mensagem: `[decision-engine] next action selected: ${decisionAction}`,
      detalhes: {
        operationId,
        action: decisionAction,
        bestProduct: decisions?.bestProduct?.label ?? null,
        bestCreative: decisions?.bestCreative?.label ?? null,
        bestLanding: decisions?.bestLanding?.label ?? null,
        bestCampaign: decisions?.bestCampaign?.label ?? null,
      },
    });
  }

  console.info("[ceo-operation] action resolved", {
    operationId,
    nextFromSteps,
    executableAction,
  });

  const action = executableAction ?? resolveContinueOperationAction(nextFromSteps);

  switch (action) {
    case "creatives":
      return generateOperationAssets(operationId, "creatives");
    case "landing":
      return generateOperationLandingPage(operationId);
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
      console.warn("[ceo-operation] continueOperation: no executable action", {
        operationId,
        nextFromSteps,
        nextSteps: dashboard.nextSteps,
      });
      return {
        operation: dashboard.operation,
        message: nextFromSteps || "Revise os próximos passos no Operation Center.",
        error: null,
      };
  }
}

export async function executeCeoOperationCommand(
  command: CeoOperationCommand
): Promise<{
  dashboard: OperationCenterDashboard | null;
  message: string;
  error: string | null;
}> {
  console.info("[ceo-operation] command detected", { command });

  const { dashboard, error: dashError } = await getOperationCenterState();
  if (dashError || !dashboard?.operation) {
    console.warn("[ceo-operation] no active operation", { dashError });
    return {
      dashboard: null,
      message: "",
      error: dashError ?? "Nenhuma operação ativa no Operation Center.",
    };
  }

  const operationId = dashboard.operation.id;
  console.info("[ceo-operation] active operation id", {
    operationId,
    titulo: dashboard.operation.titulo,
    copylabId: dashboard.operation.copylab_id,
    copyStep: dashboard.progress.find((step) => step.id === "copy")?.status ?? "unknown",
  });

  let result: { operation: OperationCenter | null; message: string; error: string | null };

  switch (command) {
    case "continue":
      result = await continueOperation(operationId);
      break;
    case "copy":
      console.info("[ceo-operation] action resolved", { operationId, action: "copy" });
      result = await generateOperationCopy(operationId);
      break;
    case "creatives":
      result = await generateOperationAssets(operationId, "creatives");
      break;
    case "landing":
      result = await generateOperationAssets(operationId, "landing");
      break;
    case "campaign":
      result = await prepareOperationCampaign(operationId);
      break;
    case "performance":
      result = await sendOperationToPerformanceAi(operationId);
      break;
    case "approve": {
      const approveResult = await approveOperation(operationId);
      result = {
        operation: approveResult.operation,
        message: approveResult.message,
        error: approveResult.error,
      };
      break;
    }
  }

  recordSystemLog({
    tipo: result.error ? "warning" : "success",
    modulo: "ceo",
    mensagem: result.error ?? `Pipeline operacional: ${result.message}`,
    detalhes: {
      command,
      operationId,
      operationStatus: result.operation?.status ?? dashboard.operation.status,
    },
  });

  const refreshed = await getOperationCenterState();
  return {
    dashboard: refreshed.dashboard,
    message: result.message,
    error: result.error,
  };
}

export async function executeCeoOperationFromMessage(
  message: string
): Promise<{
  dashboard: OperationCenterDashboard | null;
  message: string;
  error: string | null;
}> {
  const command = resolveCeoOperationCommand(message);
  console.info("[ceo-operation] command detected", { message: message.slice(0, 120), command });
  if (!command) {
    return { dashboard: null, message: "", error: "Comando operacional não reconhecido." };
  }
  return executeCeoOperationCommand(command);
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

  const commandFromMode: CeoOperationCommand | null =
    mode === "op-continue"
      ? "continue"
      : mode === "op-generate-creatives"
        ? "creatives"
        : mode === "op-execute-copy"
          ? "copy"
          : mode === "op-execute-landing"
            ? "landing"
            : mode === "op-execute-performance"
              ? "performance"
              : mode === "op-prepare-campaign"
                ? "campaign"
                : mode === "op-approve"
                  ? "approve"
                  : null;

  if (commandFromMode) {
    const result = await executeCeoOperationCommand(commandFromMode);
    return {
      dashboard: result.dashboard ?? dashboard,
      actionResult: { message: result.message, error: result.error },
      error: null,
    };
  }

  switch (mode) {
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
