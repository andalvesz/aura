import { recordSystemLog } from "@/lib/logs/record";
import OpenAI from "openai";
import { AuraSmartLaunchRepository } from "@/lib/supabase/repositories/smart-launch.repository";
import { buildAuraContext } from "@/lib/supabase/services/aura-brain.service";
import { prepareLaunch } from "@/lib/supabase/services/campaign-orchestrator.service";
import { generateCopylab } from "@/lib/supabase/services/copylab.service";
import {
  generateCreatorOffer,
  generateCreatorProduct,
  loadCreatorBundles,
} from "@/lib/supabase/services/creator.service";
import { generateStudioAssets } from "@/lib/supabase/services/creative-studio.service";
import { generateLanding } from "@/lib/supabase/services/landing-builder.service";
import { getMetaIntelligenceContext } from "@/lib/supabase/services/meta-intelligence.service";
import { generateProductFactory } from "@/lib/supabase/services/product-factory.service";
import { getPerformanceContext } from "@/lib/supabase/services/performance.service";
import {
  analyzeMarketOpportunity,
  createProductFromResearch,
} from "@/lib/supabase/services/research.service";
import { getRevenueContext } from "@/lib/supabase/services/revenue.service";
import type { AuraSmartLaunchSession, TableInsert } from "@/types/database";
import type { CreatorProductBundle } from "@/utils/creator";
import { intakeFromProductBundle as copyIntakeFromBundle } from "@/utils/copylab";
import { intakeFromProductBundle as studioIntakeFromBundle } from "@/utils/creative-studio";
import { intakeFromProductBundle as landingIntakeFromBundle } from "@/utils/landing-builder";
import { parseBudgetInput } from "@/utils/campaign-budget";
import { pickLocaleFields, resolveCreatorLocale } from "@/utils/creator-locale";
import {
  buildSmartLaunchAuraContext,
  computeSmartLaunchDashboard,
  SMART_LAUNCH_AI_CONTEXT,
  SMART_LAUNCH_SAFE_MODE,
  type GeneratedSmartLaunchPlan,
  type SmartLaunchCenterData,
  type SmartLaunchDashboardMetrics,
  type SmartLaunchIntake,
} from "@/utils/smart-launch";
import { getOptionalDataContext } from "./context";

function getOpenAi() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function parseJsonBlock<T>(text: string): T | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

async function callSmartLaunchAi<T>(system: string, user: string): Promise<T | null> {
  const openai = getOpenAi();
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  return parseJsonBlock<T>(content);
}

const SYSTEM_PROMPT = `${SMART_LAUNCH_AI_CONTEXT}
Responda APENAS JSON:
{
  "smart_score": {
    "probabilidade_sucesso": number,
    "risco": "baixo" | "medio" | "alto",
    "roi_estimado": number,
    "tempo_estimado_dias": number,
    "score_geral": number
  },
  "generated_outputs": {
    "produto": string,
    "oferta": string,
    "pdf": string,
    "landing": string,
    "estrategia": string,
    "campanha_meta": string,
    "publico": string,
    "cronograma": [{ "dia": number, "foco": string, "tarefas": string[] }]
  },
  "estrategia": string,
  "resumo": string
}
Regras:
- score_geral e probabilidade_sucesso: 0-100
- roi_estimado em percentual
- cronograma de 14 dias
- campanha_meta: estrutura em RASCUNHO (nunca publicar)
- Use orçamento e meta financeira informados`;

async function loadBundleById(productId: string): Promise<CreatorProductBundle | null> {
  const { bundles } = await loadCreatorBundles();
  return bundles.find((b) => b.product.id === productId) ?? null;
}

export async function loadSmartLaunchSessions(): Promise<{
  sessions: AuraSmartLaunchSession[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { sessions: [], error: "Usuário não autenticado." };

  const repo = new AuraSmartLaunchRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findAllOrdered();
  if (error) return { sessions: [], error };
  return { sessions: data ?? [], error: null };
}

export async function getSmartLaunchDashboard(sessionId?: string | null): Promise<{
  dashboard: SmartLaunchDashboardMetrics | null;
  center: SmartLaunchCenterData | null;
  sessions: AuraSmartLaunchSession[];
  error: string | null;
}> {
  const { sessions, error } = await loadSmartLaunchSessions();
  if (error) {
    return { dashboard: null, center: null, sessions: [], error };
  }

  const session =
    (sessionId ? sessions.find((s) => s.id === sessionId) : null) ?? sessions[0] ?? null;

  let bundle: CreatorProductBundle | null = null;
  if (session?.product_id) {
    bundle = await loadBundleById(session.product_id);
  }

  return {
    dashboard: computeSmartLaunchDashboard(sessions),
    center: { session, bundle },
    sessions,
    error: null,
  };
}

export async function getSmartLaunchContext(): Promise<{ context: string; error: string | null }> {
  const { center } = await getSmartLaunchDashboard();
  const lines = [
    "## AURA SMART LAUNCH",
    buildSmartLaunchAuraContext(center?.session ?? null, center?.bundle ?? null),
    `Modo seguro: ${SMART_LAUNCH_SAFE_MODE ? "ATIVO" : "desativado"}`,
  ];
  return { context: lines.join("\n\n"), error: null };
}

async function resolveOrCreateProduct(
  input: SmartLaunchIntake
): Promise<{ bundle: CreatorProductBundle | null; researchId: string | null; error: string | null }> {
  if (input.product_id?.trim()) {
    const bundle = await loadBundleById(input.product_id);
    if (!bundle) return { bundle: null, researchId: null, error: "Produto não encontrado." };
    return { bundle, researchId: null, error: null };
  }

  const ideia =
    input.ideia?.trim() ||
    (input.product_type === "afiliado"
      ? `Produto afiliado em ${input.nicho || "nicho digital"}`
      : `Produto digital em ${input.nicho || "mercado digital"}`);

  const researchIntake = {
    ideia,
    nicho: input.nicho?.trim() || "Mercado digital",
    publico: input.publico?.trim() || "Público geral interessado no nicho",
    target_country: input.target_country,
    target_language: input.target_language,
    currency: input.currency,
  };

  const { record: research, error: researchError } = await analyzeMarketOpportunity(researchIntake);
  if (researchError || !research) {
    return { bundle: null, researchId: null, error: researchError ?? "Erro na pesquisa de mercado." };
  }

  if (input.product_type === "proprio") {
    const { bundle, error: productError } = await createProductFromResearch(research.id);
    if (productError || !bundle) {
      const creatorIntake = {
        nicho: researchIntake.nicho,
        conhecimento: research.diferencial_sugerido ?? ideia,
        publico_alvo: researchIntake.publico,
        objetivo_financeiro: input.meta_financeira,
        prazo: "30 dias",
        target_country: input.target_country,
        target_language: input.target_language,
        currency: input.currency,
      };
      const { bundle: generated, error: genError } = await generateCreatorProduct({
        intake: creatorIntake,
        useAuraData: true,
      });
      return {
        bundle: generated,
        researchId: research.id,
        error: genError ?? productError,
      };
    }
    return { bundle, researchId: research.id, error: null };
  }

  const affiliateIntake = {
    nicho: `Afiliação: ${researchIntake.nicho}`,
    conhecimento: research.diferencial_sugerido ?? ideia,
    publico_alvo: researchIntake.publico,
    objetivo_financeiro: input.meta_financeira,
    prazo: "30 dias",
    target_country: input.target_country,
    target_language: input.target_language,
    currency: input.currency,
  };

  const { bundle, error: affiliateError } = await generateCreatorProduct({
    intake: affiliateIntake,
    useAuraData: true,
  });

  return { bundle, researchId: research.id, error: affiliateError };
}

export async function prepareSmartLaunch(input: SmartLaunchIntake): Promise<{
  session: AuraSmartLaunchSession | null;
  center: SmartLaunchCenterData | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { session: null, center: null, error: "Usuário não autenticado." };
  if (!getOpenAi()) {
    return { session: null, center: null, error: "IA indisponível (OPENAI_API_KEY)." };
  }

  const metaFinanceira = parseBudgetInput(input.meta_financeira);
  const orcamentoDisponivel = parseBudgetInput(input.orcamento_disponivel);

  if (metaFinanceira == null) {
    return { session: null, center: null, error: "Informe a meta financeira." };
  }
  if (orcamentoDisponivel == null) {
    return { session: null, center: null, error: "Informe o orçamento disponível." };
  }

  const repo = new AuraSmartLaunchRepository(ctx.supabase, ctx.userId);

  const draftPayload = {
    product_type: input.product_type,
    ...pickLocaleFields(resolveCreatorLocale(input)),
    meta_financeira: metaFinanceira,
    orcamento_disponivel: orcamentoDisponivel,
    current_step: 4,
    status: "preparing" as const,
    safe_mode: SMART_LAUNCH_SAFE_MODE,
    ideia: input.ideia?.trim() || null,
    nicho: input.nicho?.trim() || null,
  } satisfies Omit<TableInsert<"aura_smart_launch_sessions">, "user_id">;

  let sessionRecord: AuraSmartLaunchSession | null = null;

  if (input.session_id) {
    const { data: updated, error: updateError } = await repo.update(input.session_id, draftPayload);
    if (updateError || !updated) {
      return { session: null, center: null, error: updateError ?? "Erro ao atualizar sessão." };
    }
    sessionRecord = updated as AuraSmartLaunchSession;
  } else {
    const { data: created, error: createError } = await repo.create(draftPayload);
    if (createError || !created) {
      return { session: null, center: null, error: createError ?? "Erro ao criar sessão." };
    }
    sessionRecord = created as AuraSmartLaunchSession;
  }

  const warnings: string[] = [];

  const { decisions: launchDecisions } = await import("./aura-decision-engine.service").then(
    (mod) => mod.consultDecisionEngine("smart_launch")
  );
  if (launchDecisions?.bestProduct) {
    warnings.push(
      `Decision Engine recomenda: ${launchDecisions.bestProduct.label} (${launchDecisions.bestProduct.source})`
    );
    recordSystemLog({
      tipo: "info",
      modulo: "decision-engine",
      mensagem: "Smart Launch priorizado pelo Decision Engine",
      detalhes: {
        module: "smart_launch",
        recommendedProduct: launchDecisions.bestProduct.label,
        source: launchDecisions.bestProduct.source,
        confidence: launchDecisions.confidence,
        sessionId: sessionRecord.id,
      },
    });
  }

  const { bundle, researchId, error: productError } = await resolveOrCreateProduct(input);
  if (productError || !bundle) {
    await repo.update(sessionRecord.id, { status: "failed" });
    return { session: null, center: null, error: productError ?? "Erro ao criar produto." };
  }

  let currentBundle = bundle;
  let copylabId: string | null = null;
  let factoryId: string | null = null;
  let landingId: string | null = null;
  let assetId: string | null = null;
  let adsCampaignId: string | null = null;
  let orchestrationId: string | null = null;

  if (!currentBundle.offer) {
    const { bundle: withOffer, error: offerError } = await generateCreatorOffer(currentBundle.product.id);
    if (withOffer) currentBundle = withOffer;
    else if (offerError) warnings.push(`Oferta: ${offerError}`);
  }

  const copyIntake = { ...copyIntakeFromBundle(currentBundle), product_id: currentBundle.product.id };
  const { record: copy, error: copyError } = await generateCopylab(copyIntake);
  if (copy) copylabId = copy.id;
  else if (copyError) warnings.push(`CopyLab: ${copyError}`);

  const factoryIntake = {
    titulo: currentBundle.product.nome ?? "Produto digital",
    promessa: currentBundle.product.promessa ?? currentBundle.product.solucao ?? "",
    avatar: currentBundle.product.avatar ?? "",
    publico: currentBundle.product.publico_alvo ?? "",
    problema: currentBundle.product.problema ?? "",
    solucao: currentBundle.product.solucao ?? "",
    product_type: "ebook" as const,
    product_id: currentBundle.product.id,
    copylab_id: copylabId,
    research_id: researchId,
  };
  const { bundle: factoryBundle, error: factoryError } = await generateProductFactory(factoryIntake);
  if (factoryBundle?.factory) factoryId = factoryBundle.factory.id;
  else if (factoryError) warnings.push(`Product Factory: ${factoryError}`);

  const landingIntake = {
    ...landingIntakeFromBundle(currentBundle, "pagina_simples"),
    product_id: currentBundle.product.id,
    copylab_id: copylabId,
  };
  const { record: landing, error: landingError } = await generateLanding(landingIntake);
  if (landing) landingId = landing.id;
  else if (landingError) warnings.push(`Landing: ${landingError}`);

  const studioIntake = {
    ...studioIntakeFromBundle(currentBundle),
    product_id: currentBundle.product.id,
    copylab_id: copylabId,
  };
  const { record: asset, error: assetError } = await generateStudioAssets(studioIntake, "full");
  if (asset) assetId = asset.id;
  else if (assetError) warnings.push(`Creative Studio: ${assetError}`);

  const { orchestration, error: orchError } = await prepareLaunch({
    product_id: currentBundle.product.id,
    orcamento_disponivel: orcamentoDisponivel,
  });

  if (orchestration) {
    orchestrationId = orchestration.id;
    adsCampaignId = orchestration.ads_campaign_id;
  } else if (orchError) {
    warnings.push(`Orchestrator: ${orchError}`);
  }

  const [brain, metaCtx, revenueCtx, performanceCtx] = await Promise.all([
    buildAuraContext(),
    getMetaIntelligenceContext(),
    getRevenueContext(),
    getPerformanceContext(),
  ]);

  const locale = resolveCreatorLocale(input);

  const generated = await callSmartLaunchAi<GeneratedSmartLaunchPlan>(
    `${SYSTEM_PROMPT}
Mercado: ${locale.target_country} · ${locale.target_language} · ${locale.currency}
Meta financeira: ${metaFinanceira} · Orçamento: ${orcamentoDisponivel}
Tipo: ${input.product_type}`,
    JSON.stringify({
      product: currentBundle.product,
      offer: currentBundle.offer,
      validation: currentBundle.validation,
      research_id: researchId,
      copy_headline: copy?.headline,
      factory_status: factoryBundle?.factory?.status,
      landing_headline: landing?.headline,
      asset_nome: asset?.nome,
      orchestration: orchestration
        ? {
            score: orchestration.score_lancamento,
            roi: orchestration.roi_estimado,
            resumo: orchestration.resumo,
          }
        : null,
      aura_brain: brain.context?.slice(0, 1500),
      meta_intelligence: metaCtx.context?.slice(0, 800),
      revenue: revenueCtx.context?.slice(0, 500),
      performance: performanceCtx.context?.slice(0, 500),
      decision_engine: launchDecisions
        ? {
            bestProduct: launchDecisions.bestProduct,
            bestCountry: launchDecisions.bestCountry,
            bestOffer: launchDecisions.bestOffer,
            confidence: launchDecisions.confidence,
          }
        : null,
      warnings,
      safe_mode: SMART_LAUNCH_SAFE_MODE,
    })
  );

  if (!generated?.resumo) {
    await repo.update(sessionRecord.id, { status: "failed" });
    return { session: null, center: null, error: "Não foi possível gerar o lançamento." };
  }

  const finalPayload = {
    status: "prepared" as const,
    product_id: currentBundle.product.id,
    research_id: researchId,
    copylab_id: copylabId,
    factory_id: factoryId,
    landing_id: landingId,
    asset_id: assetId,
    ads_campaign_id: adsCampaignId,
    orchestration_id: orchestrationId,
    smart_score: generated.smart_score,
    generated_outputs: {
      ...generated.generated_outputs,
      orchestrator_plan: orchestration?.plano_lancamento ?? null,
      warnings,
    },
    estrategia: generated.estrategia,
    resumo: generated.resumo,
  } satisfies Partial<TableInsert<"aura_smart_launch_sessions">>;

  const { data: finalSession, error: finalError } = await repo.update(sessionRecord.id, finalPayload);
  if (finalError || !finalSession) {
    return { session: null, center: null, error: finalError ?? "Erro ao salvar lançamento." };
  }

  const session = finalSession as AuraSmartLaunchSession;
  return {
    session,
    center: { session, bundle: currentBundle },
    error: null,
  };
}

export async function deleteSmartLaunchSession(id: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new AuraSmartLaunchRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.delete(id);
  return { error };
}
