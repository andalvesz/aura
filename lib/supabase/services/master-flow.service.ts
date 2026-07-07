import { recordSystemLog } from "@/lib/logs/record";
import { CreatorProductsRepository } from "@/lib/supabase/repositories/creator.repository";
import { FunnelsRepository } from "@/lib/supabase/repositories/funnel-engine.repository";
import { MasterFlowRepository } from "@/lib/supabase/repositories/master-flow.repository";
import { OperationCenterRepository } from "@/lib/supabase/repositories/operation-center.repository";
import type { MasterFlow, MasterFlowStep, TableInsert } from "@/types/database";
import { intakeFromProductBundle } from "@/utils/copylab";
import {
  buildMasterFlowStatusView,
  computeMasterFlowProgress,
  getNextMasterFlowStep,
  isMasterFlowMutable,
  mergeMasterFlowMetadata,
  normalizeMasterFlowStep,
  readMasterFlowMetadata,
  type MasterFlowStatusView,
} from "@/utils/master-flow";
import { intakeFromProductBundle as factoryIntakeFromBundle } from "@/utils/product-factory";
import {
  intentFromMetadata,
  intentToMetadata,
  type MasterFlowIntentInput,
} from "@/utils/master-flow-intent";
import { resolveIntentV2 } from "@/utils/intent-engine-v2";
import { resolveCreatorLocale } from "@/utils/creator-locale";
import { toCreatorCountryFromIntent, toCreatorLanguageFromIntent } from "@/utils/master-flow-intent";
import { getOptionalDataContext } from "./context";
import {
  buildMissionStatus,
  isStepCompleted,
  MISSION_APPROVAL_GATE_STEP,
  MISSION_KNOWLEDGE_STEPS,
  planRunUntilBlockedIteration,
  RUN_UNTIL_BLOCKED_MAX_STEPS,
  type MissionStatus,
} from "@/utils/mission-core";
import type { ExpertBrainCategory } from "@/types/database";

const KNOWLEDGE_PREFLIGHT_BY_STEP: Partial<
  Record<MasterFlowStep, { task: ExpertBrainCategory; module: string }>
> = {
  product_factory: { task: "product_creation", module: "product-factory" },
  sales_system: { task: "offer_creation", module: "offer-engine" },
  copylab: { task: "copywriting", module: "copylab" },
  offer_engine: { task: "offer_creation", module: "offer-engine" },
  funnel_pages: { task: "landing_page", module: "landing-factory" },
};

async function skipCompletedStep(
  repo: MasterFlowRepository,
  flow: MasterFlow,
  step: MasterFlowStep
): Promise<MasterFlow | null> {
  const nextStep = getNextMasterFlowStep(step);
  if (nextStep === step) return flow;

  const { data } = await repo.update(flow.id, {
    current_step: nextStep,
    progress: computeMasterFlowProgress(nextStep),
  });
  return data;
}

async function preflightKnowledgeForStep(
  flow: MasterFlow,
  step: MasterFlowStep
): Promise<string[]> {
  const config = KNOWLEDGE_PREFLIGHT_BY_STEP[step];
  if (!config) return [];

  const meta = readMasterFlowMetadata(flow);
  const { buildTransversalGenerationContext } = await import("./expert-brain.service");
  const transversal = await buildTransversalGenerationContext({
    task: config.task,
    module: config.module,
    niche: meta.niche,
  });

  const ctx = transversal.expertContext;
  const totalItems =
    ctx.frameworks.length +
    ctx.playbooks.length +
    ctx.patterns.length +
    ctx.decisionRules.length +
    ctx.checklists.length;

  const warnings: string[] = [];
  if (totalItems === 0) {
    warnings.push(
      "Expert Brain vazio — a geração seguirá sem conhecimento personalizado. Faça upload de materiais para melhorar os resultados."
    );
  }

  return warnings;
}

async function mergeKnowledgeWarnings(
  repo: MasterFlowRepository,
  flow: MasterFlow,
  warnings: string[]
): Promise<MasterFlow | null> {
  if (warnings.length === 0) return flow;

  const meta = readMasterFlowMetadata(flow);
  const merged = [...new Set([...(meta.knowledge_warnings ?? []), ...warnings])];
  const { data } = await repo.update(flow.id, {
    metadata: mergeMasterFlowMetadata(flow.metadata, { knowledge_warnings: merged }),
  });
  return data;
}

async function markStepCompleted(
  repo: MasterFlowRepository,
  flow: MasterFlow,
  step: MasterFlowStep
): Promise<MasterFlow | null> {
  const meta = readMasterFlowMetadata(flow);
  const completed = new Set(meta.completed_steps ?? []);
  completed.add(step);

  const nextStep = getNextMasterFlowStep(step);
  const isDone = nextStep === "done";

  const { data } = await repo.update(flow.id, {
    current_step: nextStep,
    progress: isDone ? 100 : computeMasterFlowProgress(nextStep),
    status: isDone ? "completed" : "running",
    metadata: mergeMasterFlowMetadata(flow.metadata, {
      completed_steps: Array.from(completed),
      last_error: null,
    }),
  });

  return data;
}

async function failFlow(
  repo: MasterFlowRepository,
  flow: MasterFlow,
  message: string
): Promise<MasterFlow | null> {
  const { data } = await repo.update(flow.id, {
    status: "failed",
    metadata: mergeMasterFlowMetadata(flow.metadata, { last_error: message }),
  });
  return data;
}

async function ensureCreatorProduct(
  flow: MasterFlow,
  hints: {
    name: string;
    niche?: string | null;
    promessa?: string | null;
    avatar?: string | null;
    country?: string | null;
    language?: string | null;
    ticket?: number | null;
  }
): Promise<{ productId: string | null; error: string | null }> {
  if (flow.product_id) return { productId: flow.product_id, error: null };

  const ctx = await getOptionalDataContext();
  if (!ctx) return { productId: null, error: "Usuário não autenticado." };

  const creatorCountry = toCreatorCountryFromIntent(hints.country);
  const creatorLanguage = toCreatorLanguageFromIntent(hints.language, hints.country);
  const locale = resolveCreatorLocale({
    target_country: creatorCountry,
    target_language: creatorLanguage,
  });

  const productsRepo = new CreatorProductsRepository(ctx.supabase, ctx.userId);
  const { data: product, error } = await productsRepo.create({
    status: "ideia",
    nome: hints.name,
    nicho: hints.niche ?? null,
    problema: hints.promessa ?? `Resolver desafios em ${hints.niche ?? "mercado digital"}`,
    solucao: hints.promessa ?? hints.name,
    promessa: hints.promessa ?? hints.name,
    avatar: hints.avatar ?? hints.niche ?? "Empreendedor digital",
    publico_alvo: hints.avatar ?? hints.niche ?? "Público digital",
    publico_alvo_input: hints.avatar ?? hints.niche ?? null,
    conhecimento: hints.niche ?? null,
    mecanismo_unico: hints.name,
    diferenciais: hints.name,
    used_aura_data: true,
    target_country: locale.target_country,
    target_language: locale.target_language,
    currency: locale.currency,
    faixa_preco_min: hints.ticket ?? null,
    faixa_preco_max: hints.ticket != null ? Math.round(hints.ticket * 1.5) : null,
    investimento_previsto: null,
    receita_prevista: null,
    roi_estimado: null,
  } satisfies Omit<TableInsert<"creator_products">, "user_id">);

  if (error || !product) {
    return { productId: null, error: error ?? "Erro ao criar produto." };
  }

  return { productId: product.id, error: null };
}

async function ensureOperation(
  flow: MasterFlow,
  productName: string
): Promise<{ operationId: string | null; error: string | null }> {
  const meta = readMasterFlowMetadata(flow);
  if (meta.operation_id) return { operationId: meta.operation_id, error: null };

  const ctx = await getOptionalDataContext();
  if (!ctx) return { operationId: null, error: "Usuário não autenticado." };

  const opRepo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  const { data: operation, error } = await opRepo.create({
    status: "preparing",
    titulo: `Master Flow — ${productName}`,
    product_id: flow.product_id,
    product_nome: productName,
    copylab_id: meta.copylab_id ?? null,
  } satisfies Omit<TableInsert<"operation_center">, "user_id">);

  if (error || !operation) {
    return { operationId: null, error: error ?? "Erro ao criar operação." };
  }

  return { operationId: operation.id, error: null };
}

async function executeStep(flow: MasterFlow): Promise<{
  flow: MasterFlow | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { flow: null, error: "Usuário não autenticado." };

  const repo = new MasterFlowRepository(ctx.supabase, ctx.userId);
  const step = flow.current_step;
  const meta = readMasterFlowMetadata(flow);
  const intent = intentFromMetadata(meta);

  recordSystemLog({
    tipo: "info",
    modulo: "master-flow",
    mensagem: `Executando etapa ${step}`,
    detalhes: { flowId: flow.id, step },
  });

  try {
    switch (step) {
      case "opportunity_engine":
      case "market_hunter": {
        const { runOpportunityEngine } = await import("@/lib/opportunity/opportunity-engine");
        const goalText =
          meta.user_intent ??
          intent.raw ??
          (intent.niche ? `Quero ganhar com ${intent.niche}` : "Quero ganhar R$10.000 por mês");
        const { recommendations } = runOpportunityEngine(goalText);
        const top = recommendations[0];

        if (!top) {
          return {
            flow: await failFlow(repo, flow, "Nenhuma oportunidade compatível encontrada."),
            error: "Nenhuma oportunidade compatível encontrada.",
          };
        }

        const { data: updated } = await repo.update(flow.id, {
          metadata: mergeMasterFlowMetadata(flow.metadata, {
            opportunity_name: top.recommendedProduct,
            niche: top.niche,
            avatar: top.avatar,
            ticket: top.price,
            opportunity_engine_score: top.opportunityScore.total,
            opportunity_recommendations: recommendations.map((r) => r.title),
            selected_opportunity: top,
          }),
        });

        return {
          flow: await markStepCompleted(repo, updated ?? flow, normalizeMasterFlowStep(step)),
          error: null,
        };
      }

      case "validation_engine": {
        const { validateOpportunity } = await import("@/lib/validation/validation-engine");
        const opportunity =
          meta.selected_opportunity ??
          ({
            title: meta.opportunity_name ?? "Oportunidade digital",
            niche: meta.niche ?? intent.niche ?? "Mercado digital",
            avatar: meta.avatar ?? "Empreendedor digital",
            problem: meta.user_intent ?? `Resolver desafios em ${meta.niche ?? "mercado digital"}`,
            market: null,
            technology: null,
            businessModel: "Curso",
            confidence: 50,
            recommendedProduct: meta.opportunity_name ?? "Produto digital",
            price: meta.ticket ?? 97,
            opportunityScore: {
              demand: 50,
              competition: 50,
              ticket: 50,
              production: 50,
              launchSpeed: 50,
              scalability: 50,
              margin: 50,
              total: meta.opportunity_engine_score ?? 50,
            },
            intentMatchScore: 50,
            estimatedProfit: 0,
            investmentScore: 50,
            uniquenessScore: 50,
            reason: meta.user_intent ?? "",
          } satisfies import("@/lib/opportunity/opportunity-types").OpportunityRecommendation);

        const validation = validateOpportunity(opportunity);

        if (!validation.approved) {
          const message = validation.recommendation;
          const { data: paused } = await repo.update(flow.id, {
            status: "paused",
            metadata: mergeMasterFlowMetadata(flow.metadata, {
              validation_score: validation.validationScore,
              validation_approved: false,
              validation_recommendation: validation.recommendation,
              validation_reasons: validation.reasons,
              last_error: message,
            }),
          });

          return {
            flow: paused ?? flow,
            error: message,
          };
        }

        const { data: updated } = await repo.update(flow.id, {
          metadata: mergeMasterFlowMetadata(flow.metadata, {
            validation_score: validation.validationScore,
            validation_approved: true,
            validation_recommendation: validation.recommendation,
            validation_reasons: validation.reasons,
            last_error: null,
          }),
        });

        return {
          flow: await markStepCompleted(repo, updated ?? flow, step),
          error: null,
        };
      }

      case "product_strategist": {
        if (meta.validation_approved !== true) {
          const message =
            meta.validation_recommendation ??
            "Validação pendente — estratégia de produto exige oportunidade aprovada.";
          return { flow: await failFlow(repo, flow, message), error: message };
        }

        const { runProductStrategist } = await import("@/lib/product-strategist/product-strategist");
        const { validateOpportunity } = await import("@/lib/validation/validation-engine");

        const opportunity =
          meta.selected_opportunity ??
          ({
            title: meta.opportunity_name ?? "Oportunidade digital",
            niche: meta.niche ?? intent.niche ?? "Mercado digital",
            avatar: meta.avatar ?? "Empreendedor digital",
            problem: meta.user_intent ?? `Resolver desafios em ${meta.niche ?? "mercado digital"}`,
            market: null,
            technology: null,
            businessModel: "Curso",
            confidence: 50,
            recommendedProduct: meta.opportunity_name ?? "Produto digital",
            price: meta.ticket ?? 97,
            opportunityScore: {
              demand: 50,
              competition: 50,
              ticket: 50,
              production: 50,
              launchSpeed: 50,
              scalability: 50,
              margin: 50,
              total: meta.opportunity_engine_score ?? 50,
            },
            intentMatchScore: 50,
            estimatedProfit: 0,
            investmentScore: 50,
            uniquenessScore: 50,
            reason: meta.user_intent ?? "",
          } satisfies import("@/lib/opportunity/opportunity-types").OpportunityRecommendation);

        const validation =
          meta.validation_score != null
            ? {
                approved: true,
                validationScore: meta.validation_score,
                marketConfidence: 70,
                executionDifficulty: 40,
                competitionRisk: 35,
                marketTiming: 70,
                monetizationPotential: 75,
                recommendation: meta.validation_recommendation ?? "Aprovado.",
                reasons: meta.validation_reasons ?? [],
              }
            : validateOpportunity(opportunity);

        const strategist = runProductStrategist({ opportunity, validation });
        const chosen = strategist.recommendation;
        const productName = `${chosen.strategyName} — ${opportunity.niche}`;

        const { data: updated } = await repo.update(flow.id, {
          metadata: mergeMasterFlowMetadata(flow.metadata, {
            product_strategies: strategist.strategies,
            selected_strategy: chosen,
            product_strategist_score: chosen.scores.total,
            product_strategist_explanation: strategist.explanation,
            opportunity_name: productName,
            ticket: chosen.ticket,
            last_error: null,
          }),
        });

        return {
          flow: await markStepCompleted(repo, updated ?? flow, step),
          error: null,
        };
      }

      case "decision_engine": {
        const { getUnifiedDecisions } = await import("./aura-decision-engine.service");
        const { decisions, error } = await getUnifiedDecisions(intent);
        if (error) return { flow: await failFlow(repo, flow, error), error };

        const best = decisions?.bestProduct;
        const execution = decisions?.execution;
        const name =
          best?.label ??
          meta.opportunity_name ??
          (intent.niche ? `Programa de ${intent.niche}` : "Negócio digital Aura");

        const { data: updated } = await repo.update(flow.id, {
          metadata: mergeMasterFlowMetadata(flow.metadata, {
            opportunity_name: name,
            niche: (best?.metadata?.niche as string | undefined) ?? meta.niche ?? intent.niche ?? null,
            country: execution?.country?.label ?? intent.country ?? decisions?.bestCountry?.label ?? meta.country ?? null,
            language: execution?.language?.label ?? intent.language ?? decisions?.bestLanguage?.label ?? meta.language ?? null,
            decision_score: execution?.decision_score ?? decisions?.confidence ?? null,
            decision_reason: execution?.decision_reason ?? best?.reason ?? null,
          }),
        });

        return { flow: await markStepCompleted(repo, updated ?? flow, step), error: null };
      }

      case "product_factory": {
        if (meta.validation_approved !== true) {
          const message =
            meta.validation_recommendation ??
            (meta.validation_score != null && meta.validation_score < 85
              ? "Não recomendo construir este produto."
              : "Validação pendente — o produto não pode ser criado sem aprovação.");
          return { flow: await failFlow(repo, flow, message), error: message };
        }

        if (!meta.selected_strategy) {
          const message = (
            await import("@/utils/product-build-brief")
          ).PRODUCT_STRATEGY_MISSING_ERROR;
          const { data: paused } = await repo.update(flow.id, {
            status: "paused",
            metadata: mergeMasterFlowMetadata(flow.metadata, { last_error: message }),
          });
          return { flow: paused ?? flow, error: message };
        }

        const strategy = meta.selected_strategy;
        const {
          buildProductBuildBrief,
          applyBriefToIntake,
          resolveStrategyFactoryProfile,
          evaluateStrategyAdherence,
        } = await import("@/utils/product-build-brief");

        const brief = buildProductBuildBrief({ meta });
        if (!brief) {
          const message = (
            await import("@/utils/product-build-brief")
          ).PRODUCT_STRATEGY_MISSING_ERROR;
          const { data: paused } = await repo.update(flow.id, {
            status: "paused",
            metadata: mergeMasterFlowMetadata(flow.metadata, { last_error: message }),
          });
          return { flow: paused ?? flow, error: message };
        }

        const profile = resolveStrategyFactoryProfile(brief);
        const productName = meta.opportunity_name ?? `${strategy.strategyName} — ${meta.niche ?? "Aura"}`;
        const strategyTicket = strategy.ticket ?? meta.ticket;
        const { productId, error: productError } = await ensureCreatorProduct(flow, {
          name: productName,
          niche: meta.niche,
          promessa: brief.objective,
          avatar: brief.avatar,
          country: meta.country,
          language: meta.language,
          ticket: strategyTicket,
        });
        if (productError || !productId) {
          return { flow: await failFlow(repo, flow, productError ?? "Produto não criado."), error: productError };
        }

        const { loadCreatorBundles } = await import("./creator.service");
        const { bundles } = await loadCreatorBundles();
        const bundle = bundles.find((b) => b.product.id === productId) ?? null;

        const baseIntake = bundle
          ? factoryIntakeFromBundle(bundle)
          : {
              titulo: productName,
              promessa: productName,
              avatar: brief.avatar,
              problema: brief.problem,
              solucao: productName,
              product_id: productId,
            };

        const intake = applyBriefToIntake(baseIntake, brief, profile);

        const { generateProductFactory } = await import("./product-factory.service");
        const { bundle: factoryBundle, error } = await generateProductFactory({
          ...intake,
          product_id: productId,
        });
        if (error) {
          return { flow: await failFlow(repo, flow, error), error };
        }

        const factoryId = factoryBundle?.factory.id ?? null;
        const adherence = factoryBundle?.factory
          ? evaluateStrategyAdherence(brief, factoryBundle.factory)
          : null;

        const { data: updated } = await repo.update(flow.id, {
          product_id: productId,
          metadata: mergeMasterFlowMetadata(flow.metadata, {
            factory_id: factoryId,
            product_build_brief: brief,
            product_strategy_adherence: adherence,
            product_quality_score:
              (factoryBundle?.factory.conteudo as { quality_score?: number } | null)?.quality_score ??
              meta.product_quality_score ??
              null,
            ticket: strategyTicket,
            opportunity_name: productName,
          }),
        });

        return { flow: await markStepCompleted(repo, updated ?? flow, step), error: null };
      }

      case "sales_system": {
        if (!flow.product_id) {
          return { flow: await failFlow(repo, flow, "Produto não vinculado."), error: "Produto não vinculado." };
        }

        const { runSalesSystem } = await import("./sales-system.service");
        const result = await runSalesSystem(flow);

        const { data: updated } = await repo.update(flow.id, {
          funnel_id: result.funnelId ?? flow.funnel_id,
          metadata: mergeMasterFlowMetadata(flow.metadata, result.metadataPatch),
        });

        return {
          flow: await markStepCompleted(repo, updated ?? flow, step),
          error: result.fatalError,
        };
      }

      case "investment_committee": {
        const { runInvestmentCommittee } = await import("@/lib/investment-committee/investment-committee");
        const { buildProductBuildBrief } = await import("@/utils/product-build-brief");

        const salesPackage = meta.sales_package;
        if (!salesPackage) {
          return {
            flow: await failFlow(repo, flow, "Pacote comercial ausente para auditoria."),
            error: "Pacote comercial ausente para auditoria.",
          };
        }

        const report = runInvestmentCommittee({
          salesPackage,
          meta,
          productBuildBrief: buildProductBuildBrief({ meta }),
        });

        if (!report.approved) {
          const message = report.globalRecommendation;
          const { data: paused } = await repo.update(flow.id, {
            status: "paused",
            metadata: mergeMasterFlowMetadata(flow.metadata, {
              investment_score: report.investmentScore,
              investment_approved: false,
              investment_recommendation: report.globalRecommendation,
              investment_must_fix: report.mustFix,
              investment_specialists: report.specialists,
              last_error: message,
            }),
          });

          return {
            flow: paused ?? flow,
            error: message,
          };
        }

        const { data: updated } = await repo.update(flow.id, {
          metadata: mergeMasterFlowMetadata(flow.metadata, {
            investment_score: report.investmentScore,
            investment_approved: true,
            investment_recommendation: report.globalRecommendation,
            investment_must_fix: [],
            investment_specialists: report.specialists,
            last_error: null,
          }),
        });

        return {
          flow: await markStepCompleted(repo, updated ?? flow, step),
          error: null,
        };
      }

      case "mission_review": {
        const { data: paused } = await repo.update(flow.id, {
          status: "paused",
          metadata: mergeMasterFlowMetadata(flow.metadata, {
            last_error: null,
          }),
        });

        return {
          flow: paused ?? flow,
          error: null,
        };
      }

      case "copylab": {
        if (!flow.product_id) {
          return { flow: await failFlow(repo, flow, "Produto não vinculado."), error: "Produto não vinculado." };
        }

        const { loadCreatorBundles } = await import("./creator.service");
        const { bundles } = await loadCreatorBundles();
        const bundle = bundles.find((b) => b.product.id === flow.product_id);
        if (!bundle) {
          return { flow: await failFlow(repo, flow, "Bundle do produto não encontrado."), error: "Bundle não encontrado." };
        }

        const { generateCopylab } = await import("./copylab.service");
        const { record, error } = await generateCopylab(intakeFromProductBundle(bundle));
        if (error) {
          return { flow: await failFlow(repo, flow, error), error };
        }

        const { data: updated } = await repo.update(flow.id, {
          metadata: mergeMasterFlowMetadata(flow.metadata, { copylab_id: record?.id ?? null }),
        });

        return { flow: await markStepCompleted(repo, updated ?? flow, step), error: null };
      }

      case "offer_engine": {
        if (!flow.product_id) {
          return { flow: await failFlow(repo, flow, "Produto não vinculado."), error: "Produto não vinculado." };
        }

        const { generateOfferStack } = await import("./offer-engine.service");
        const { bundle: offerBundle, error } = await generateOfferStack({
          product_id: flow.product_id,
          funnel_id: flow.funnel_id,
        });
        if (error) {
          return { flow: await failFlow(repo, flow, error), error };
        }

        const frontOffer =
          offerBundle?.offers.find((offer) => offer.offer_type === "front_end") ??
          offerBundle?.offers[0] ??
          null;

        const { data: updated } = await repo.update(flow.id, {
          metadata: mergeMasterFlowMetadata(flow.metadata, {
            offer_id: frontOffer?.id ?? null,
          }),
        });

        return { flow: await markStepCompleted(repo, updated ?? flow, step), error: null };
      }

      case "funnel_engine": {
        if (!flow.product_id) {
          return { flow: await failFlow(repo, flow, "Produto não vinculado."), error: "Produto não vinculado." };
        }

        const funnelsRepo = new FunnelsRepository(ctx.supabase, ctx.userId);
        const { data: existing } = await funnelsRepo.findLatestByProductId(flow.product_id);
        if (existing) {
          const { data: updated } = await repo.update(flow.id, { funnel_id: existing.id });
          return { flow: await markStepCompleted(repo, updated ?? flow, step), error: null };
        }

        const { generateFunnel } = await import("./funnel-engine.service");
        const { bundle, error } = await generateFunnel({
          product_id: flow.product_id,
          copylab_id: meta.copylab_id ?? null,
          factory_id: meta.factory_id ?? null,
          funnel_name: meta.opportunity_name ?? undefined,
          niche: meta.niche ?? undefined,
          auto_generate_landing: false,
        });
        if (error) {
          return { flow: await failFlow(repo, flow, error), error };
        }

        const { data: updated } = await repo.update(flow.id, {
          funnel_id: bundle?.funnel.id ?? null,
        });

        return { flow: await markStepCompleted(repo, updated ?? flow, step), error: null };
      }

      case "funnel_pages": {
        if (!flow.funnel_id) {
          return { flow: await failFlow(repo, flow, "Funil não vinculado."), error: "Funil não vinculado." };
        }

        const { generateFunnelPages } = await import("./funnel-pages.service");
        const { bundle: pagesBundle, error } = await generateFunnelPages({ funnel_id: flow.funnel_id });
        if (error) {
          return { flow: await failFlow(repo, flow, error), error };
        }

        const primaryLandingId = pagesBundle?.pages?.[0]?.landing_page_id ?? null;
        const { data: updated } = await repo.update(flow.id, {
          metadata: mergeMasterFlowMetadata(flow.metadata, {
            landing_id: primaryLandingId,
          }),
        });

        return { flow: await markStepCompleted(repo, updated ?? flow, step), error: null };
      }

      case "checkout_engine": {
        if (!flow.product_id) {
          return { flow: await failFlow(repo, flow, "Produto não vinculado."), error: "Produto não vinculado." };
        }

        const { createCheckout, syncCheckout, applyCheckoutToProduct, getCheckoutUrl } =
          await import("./checkout-engine.service");
        const { evaluateCheckoutCompletion } = await import("@/utils/revenue-certification");
        const { validateCheckoutUrl } = await import("@/utils/revenue-certification");

        const { checkout, error: createError } = await createCheckout({
          productId: flow.product_id,
          productName: meta.opportunity_name ?? undefined,
        });
        if (createError) {
          return { flow: await failFlow(repo, flow, createError), error: createError };
        }

        let checkoutUrl = checkout?.checkout_url ?? null;
        if (checkout && !checkoutUrl) {
          const synced = await syncCheckout(checkout.id);
          checkoutUrl = synced.checkout?.checkout_url ?? null;
        }

        let applyResult = { updatedLandings: 0, updatedFunnels: 0, error: null as string | null };
        if (checkoutUrl && validateCheckoutUrl(checkoutUrl)) {
          applyResult = await applyCheckoutToProduct(flow.product_id);
        } else {
          const resolved = await getCheckoutUrl(flow.product_id);
          checkoutUrl = resolved.checkoutUrl;
          if (checkoutUrl) {
            applyResult = await applyCheckoutToProduct(flow.product_id);
          }
        }

        const completion = evaluateCheckoutCompletion({
          checkoutUrl,
          updatedLandings: applyResult.updatedLandings,
          updatedFunnels: applyResult.updatedFunnels,
        });

        const { data: updated } = await repo.update(flow.id, {
          metadata: mergeMasterFlowMetadata(flow.metadata, {
            checkout_url: checkoutUrl,
            checkout_id: checkout?.id ?? null,
            checkout_completion: completion,
          }),
        });

        if (!checkoutUrl || !validateCheckoutUrl(checkoutUrl)) {
          const gapMsg = completion.gaps.join("; ") || "checkout_url inválida ou ausente";
          const { data: softUpdated } = await repo.update(flow.id, {
            metadata: mergeMasterFlowMetadata(flow.metadata, {
              checkout_url: checkoutUrl,
              checkout_id: checkout?.id ?? null,
              checkout_completion: completion,
              checkout_pending: true,
              checkout_gap: gapMsg,
            }),
          });

          return {
            flow: await markStepCompleted(repo, softUpdated ?? flow, step),
            error: null,
          };
        }

        return { flow: await markStepCompleted(repo, updated ?? flow, step), error: null };
      }

      case "creative_director": {
        const productName = meta.opportunity_name ?? "Negócio digital";
        const { operationId, error: opError } = await ensureOperation(flow, productName);
        if (opError || !operationId) {
          return { flow: await failFlow(repo, flow, opError ?? "Operação não criada."), error: opError };
        }

        const { generateCreativePackage } = await import("./creative-director.service");
        const { generatedAssets, error } = await generateCreativePackage(operationId);
        if (error) {
          return { flow: await failFlow(repo, flow, error), error };
        }

        const primaryCreativeAssetId = generatedAssets?.[0]?.id ?? null;
        const { data: updated } = await repo.update(flow.id, {
          metadata: mergeMasterFlowMetadata(flow.metadata, {
            operation_id: operationId,
            creative_asset_id: primaryCreativeAssetId,
          }),
        });

        return { flow: await markStepCompleted(repo, updated ?? flow, step), error: null };
      }

      case "ads_commander": {
        const operationId = meta.operation_id;
        if (!operationId) {
          return { flow: await failFlow(repo, flow, "Operação não vinculada."), error: "Operação não vinculada." };
        }

        const { prepareFullCampaign } = await import("./ads-commander.service");
        const { campaign, error } = await prepareFullCampaign({ operationId });
        if (error) {
          return { flow: await failFlow(repo, flow, error), error };
        }

        const { data: updated } = await repo.update(flow.id, {
          campaign_id: campaign?.id ?? null,
          metadata: mergeMasterFlowMetadata(flow.metadata, {
            campaign_id: campaign?.id ?? null,
          }),
        });

        return { flow: await markStepCompleted(repo, updated ?? flow, step), error: null };
      }

      case "publish_orchestrator": {
        const { orchestratePublish } = await import("./publish-orchestrator.service");
        const { result, error } = await orchestratePublish({
          funnelId: flow.funnel_id,
          campaignId: flow.campaign_id ?? meta.campaign_id,
          mode: "master_flow",
        });

        const { data: updated } = await repo.update(flow.id, {
          metadata: mergeMasterFlowMetadata(flow.metadata, {
            funnel_url: result.funnelUrl ?? meta.funnel_url ?? null,
            landing_url: result.landingUrl ?? meta.landing_url ?? null,
            landing_published: result.funnelPublished,
            campaign_published: result.campaignPublished,
            campaign_id: result.campaignId ?? flow.campaign_id ?? null,
            explicit_publish_approval: result.campaignPublished,
          }),
        });

        if (error && !result.funnelUrl && !flow.campaign_id) {
          return { flow: await failFlow(repo, updated ?? flow, error), error };
        }

        return { flow: await markStepCompleted(repo, updated ?? flow, step), error: null };
      }

      case "commercial_excellence":
      case "excellence": {
        const { runCommercialExcellence } = await import("./commercial-excellence.service");
        const { score, error: excellenceError } = await runCommercialExcellence({
          copylabId: meta.copylab_id,
          funnelId: flow.funnel_id,
          campaignId: flow.campaign_id,
          factoryId: meta.factory_id,
          productId: flow.product_id,
          landingId: meta.landing_id,
          creativeAssetId: meta.creative_asset_id,
          offerId: meta.offer_id,
          label: meta.opportunity_name ?? undefined,
        });
        if (excellenceError) {
          return { flow: await failFlow(repo, flow, excellenceError), error: excellenceError };
        }

        const flowWithScore = await repo.update(flow.id, {
          metadata: mergeMasterFlowMetadata(flow.metadata, {
            excellence_score: score,
            commercial_excellence_score: score,
          }),
        });

        const certifiedMetadata = mergeMasterFlowMetadata(flowWithScore.data?.metadata ?? flow.metadata, {
          excellence_score: score,
        });

        const interimFlow = {
          ...(flowWithScore.data ?? flow),
          metadata: certifiedMetadata,
        } as MasterFlow;

        const completedMeta = readMasterFlowMetadata(interimFlow);
        const completed = new Set(completedMeta.completed_steps ?? []);
        completed.add("commercial_excellence");

        const { applyReadyToSellCertification } = await import("./revenue-certification.service");
        const { certification, status: certifiedStatus } =
          await applyReadyToSellCertification(interimFlow);

        const { data: certifiedFlow } = await repo.update(flow.id, {
          current_step: "done",
          progress: 100,
          status: certifiedStatus,
          metadata: mergeMasterFlowMetadata(certifiedMetadata, {
            completed_steps: Array.from(completed),
            commercial_status: certification.commercial_status,
            certification_gaps: certification.gaps.length ? certification.gaps : null,
            checkout_url: certification.requirements.checkout_url,
            funnel_url: certification.requirements.funnel_url,
            landing_url: certification.requirements.landing_url,
            campaign_id: certification.requirements.campaign_id,
            excellence_score: certification.requirements.excellence_score,
            commercial_excellence_score: certification.requirements.excellence_score,
            last_error: certification.ready ? null : certification.gaps.join("; "),
          }),
        });

        recordSystemLog({
          tipo: certification.ready ? "info" : "warning",
          modulo: "master-flow",
          mensagem: certification.ready
            ? "Aura Master Flow certificado READY_TO_SELL"
            : "Pipeline concluído sem certificação READY_TO_SELL",
          detalhes: { flowId: flow.id, certification },
        });

        return { flow: certifiedFlow, error: certification.ready ? null : certification.gaps.join("; ") };
      }

      case "done":
        return { flow, error: null };

      default:
        return { flow: await failFlow(repo, flow, `Etapa desconhecida: ${step}`), error: "Etapa desconhecida." };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado no Master Flow.";
    return { flow: await failFlow(repo, flow, message), error: message };
  }
}

export async function runUntilBlocked(flowId: string): Promise<{
  mission: MissionStatus | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { mission: null, error: "Usuário não autenticado." };

  const repo = new MasterFlowRepository(ctx.supabase, ctx.userId);
  const { data: initial, error: loadError } = await repo.findById(flowId);
  if (loadError || !initial) {
    return { mission: null, error: loadError ?? "Fluxo não encontrado." };
  }

  let flow = initial;
  let failedStep: MasterFlowStep | null = null;
  let blockedReason: string | null = null;
  let lastError: string | null = null;
  const sessionWarnings: string[] = [];

  for (let iteration = 0; iteration < RUN_UNTIL_BLOCKED_MAX_STEPS; iteration += 1) {
    const plan = planRunUntilBlockedIteration({ flow, iteration });

    if (plan === "max_iterations") {
      blockedReason = blockedReason ?? "Limite de etapas automáticas atingido. Clique em Continuar.";
      break;
    }

    if (plan === "complete" || plan === "failed") {
      if (plan === "failed") {
        failedStep = flow.current_step;
        lastError = readMasterFlowMetadata(flow).last_error ?? "Missão falhou.";
      }
      break;
    }

    if (plan === "blocked") {
      blockedReason = "Missão pronta para revisão — aprove o pacote comercial para lançamento.";
      break;
    }

    const activeStep = flow.current_step;

    if (plan === "skip_completed") {
      const skipped = await skipCompletedStep(repo, flow, activeStep);
      if (!skipped) {
        lastError = "Erro ao avançar etapa já concluída.";
        break;
      }
      flow = skipped;
      continue;
    }

    if (MISSION_KNOWLEDGE_STEPS.has(activeStep)) {
      const warnings = await preflightKnowledgeForStep(flow, activeStep);
      sessionWarnings.push(...warnings);
      const withWarnings = await mergeKnowledgeWarnings(repo, flow, warnings);
      if (withWarnings) flow = withWarnings;
    }

    const { flow: afterStep, error: stepError } = await executeStep(flow);
    if (!afterStep) {
      failedStep = activeStep;
      lastError = stepError ?? "Erro ao executar etapa.";
      break;
    }

    flow = afterStep;
    lastError = stepError;

    if (flow.status === "failed" || flow.status === "paused") {
      if (flow.status === "failed") failedStep = activeStep;
      break;
    }

    const nextPlan = planRunUntilBlockedIteration({ flow, iteration: iteration + 1 });
    if (nextPlan === "blocked") {
      blockedReason = "Missão pronta para revisão — aprove o pacote comercial para lançamento.";
      break;
    }

    if (nextPlan === "complete") {
      break;
    }
  }

  if (blockedReason && normalizeMasterFlowStep(flow.current_step) === MISSION_APPROVAL_GATE_STEP) {
    const { data: paused } = await repo.update(flow.id, {
      status: "paused",
      metadata: mergeMasterFlowMetadata(flow.metadata, { last_error: null }),
    });
    if (paused) flow = paused;
  }

  return {
    mission: buildMissionStatus(flow, {
      failed_step: failedStep,
      blocked_reason: blockedReason,
      knowledge_warnings: sessionWarnings,
    }),
    error: lastError,
  };
}

export async function startMission(intentInput?: MasterFlowIntentInput): Promise<{
  mission: MissionStatus | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { mission: null, error: "Usuário não autenticado." };

  const intent = resolveIntentV2(intentInput);
  const intentMetadata = intentToMetadata(intent);

  const repo = new MasterFlowRepository(ctx.supabase, ctx.userId);
  const { data: active } = await repo.findActive();
  if (active && isMasterFlowMutable(active.status)) {
    const { mission, error } = await runUntilBlocked(active.id);
    return {
      mission,
      error: error ?? "Já existe uma missão em andamento. Continuando o fluxo ativo.",
    };
  }

  const { data: flow, error } = await repo.create({
    status: "running",
    current_step: "opportunity_engine",
    progress: 0,
    product_id: null,
    funnel_id: null,
    campaign_id: null,
    metadata: { completed_steps: [], knowledge_warnings: [], ...intentMetadata },
  } satisfies Omit<TableInsert<"master_flows">, "user_id">);

  if (error || !flow) {
    return { mission: null, error: error ?? "Erro ao criar missão." };
  }

  recordSystemLog({
    tipo: "info",
    modulo: "master-flow",
    mensagem: "Nova missão comercial iniciada",
    detalhes: { flowId: flow.id, intent },
  });

  return runUntilBlocked(flow.id);
}

export async function approveMissionForLaunch(flowId?: string): Promise<{
  mission: MissionStatus | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { mission: null, error: "Usuário não autenticado." };

  const repo = new MasterFlowRepository(ctx.supabase, ctx.userId);
  const { data: flow, error: loadError } = flowId
    ? await repo.findById(flowId)
    : await repo.findActive();

  if (loadError || !flow) {
    return { mission: null, error: loadError ?? "Nenhuma missão ativa encontrada." };
  }

  const meta = readMasterFlowMetadata(flow);
  if (!isStepCompleted(flow, "sales_system")) {
    return {
      mission: buildMissionStatus(flow),
      error: "O pacote comercial ainda não foi gerado.",
    };
  }

  if (!isStepCompleted(flow, "investment_committee")) {
    return {
      mission: buildMissionStatus(flow),
      error: "A auditoria do Investment Committee ainda não foi concluída.",
    };
  }

  if (meta.investment_approved !== true) {
    return {
      mission: buildMissionStatus(flow),
      error: meta.investment_recommendation ?? "Não recomendo investir dinheiro nesta missão.",
    };
  }

  const commercialScore = meta.commercial_score ?? meta.sales_package?.commercialScore ?? 0;
  if (commercialScore < 90) {
    return {
      mission: buildMissionStatus(flow),
      error: "Commercial Score abaixo de 90 — ajuste o pacote comercial antes de aprovar.",
    };
  }

  const completed = new Set((meta.completed_steps ?? []).map(normalizeMasterFlowStep));
  completed.add("mission_review");

  const { data: updated } = await repo.update(flow.id, {
    status: "completed",
    current_step: "done",
    progress: 100,
    metadata: mergeMasterFlowMetadata(flow.metadata, {
      mission_launch_approved: true,
      explicit_publish_approval: false,
      completed_steps: Array.from(completed),
      last_error: null,
    }),
  });

  recordSystemLog({
    tipo: "info",
    modulo: "master-flow",
    mensagem: "Missão aprovada para lançamento (sem publicação automática)",
    detalhes: { flowId: flow.id },
  });

  return {
    mission: buildMissionStatus(updated ?? flow),
    error: null,
  };
}

export async function advanceMission(flowId?: string): Promise<{
  mission: MissionStatus | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { mission: null, error: "Usuário não autenticado." };

  const repo = new MasterFlowRepository(ctx.supabase, ctx.userId);
  const { data: flow, error: loadError } = flowId
    ? await repo.findById(flowId)
    : await repo.findActive();

  if (loadError || !flow) {
    return { mission: null, error: loadError ?? "Nenhuma missão ativa encontrada." };
  }

  if (!isMasterFlowMutable(flow.status)) {
    return {
      mission: buildMissionStatus(flow),
      error: null,
    };
  }

  if (flow.status === "failed") {
    const { data: resumed } = await repo.update(flow.id, {
      status: "running",
      metadata: mergeMasterFlowMetadata(flow.metadata, { last_error: null }),
    });
    if (!resumed) {
      return { mission: null, error: "Erro ao retomar missão." };
    }
    return runUntilBlocked(resumed.id);
  }

  return runUntilBlocked(flow.id);
}

export async function getMissionStatus(flowId?: string): Promise<{
  mission: MissionStatus | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { mission: null, error: "Usuário não autenticado." };

  const repo = new MasterFlowRepository(ctx.supabase, ctx.userId);
  const { data: flow, error } = flowId
    ? await repo.findById(flowId)
    : await repo.findLatest();

  if (error || !flow) {
    return { mission: null, error: error ?? "Nenhuma missão encontrada." };
  }

  return { mission: buildMissionStatus(flow), error: null };
}

export async function createBusiness(intentInput?: MasterFlowIntentInput): Promise<{
  status: MasterFlowStatusView | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { status: null, error: "Usuário não autenticado." };

  const intent = resolveIntentV2(intentInput);
  const intentMetadata = intentToMetadata(intent);

  const repo = new MasterFlowRepository(ctx.supabase, ctx.userId);
  const { data: active } = await repo.findActive();
  if (active && isMasterFlowMutable(active.status)) {
    return {
      status: buildMasterFlowStatusView(active),
      error: "Já existe um fluxo em andamento.",
    };
  }

  const { data: flow, error } = await repo.create({
    status: "running",
    current_step: "opportunity_engine",
    progress: 0,
    product_id: null,
    funnel_id: null,
    campaign_id: null,
    metadata: { completed_steps: [], ...intentMetadata },
  } satisfies Omit<TableInsert<"master_flows">, "user_id">);

  if (error || !flow) {
    return { status: null, error: error ?? "Erro ao criar fluxo." };
  }

  recordSystemLog({
    tipo: "info",
    modulo: "master-flow",
    mensagem: "Novo negócio iniciado via Aura Master Flow",
    detalhes: { flowId: flow.id, intent },
  });

  const { flow: afterStep, error: stepError } = await executeStep(flow);
  if (!afterStep) {
    return { status: null, error: stepError ?? "Erro ao executar primeira etapa." };
  }

  return { status: buildMasterFlowStatusView(afterStep), error: stepError };
}

export async function runNextStep(flowId?: string): Promise<{
  status: MasterFlowStatusView | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { status: null, error: "Usuário não autenticado." };

  const repo = new MasterFlowRepository(ctx.supabase, ctx.userId);
  const { data: flow, error: loadError } = flowId
    ? await repo.findById(flowId)
    : await repo.findActive();

  if (loadError || !flow) {
    return { status: null, error: loadError ?? "Nenhum fluxo ativo encontrado." };
  }

  if (!isMasterFlowMutable(flow.status)) {
    return { status: buildMasterFlowStatusView(flow), error: "Fluxo já finalizado." };
  }

  if (flow.current_step === "done" || flow.status === "completed") {
    return { status: buildMasterFlowStatusView(flow), error: null };
  }

  const { flow: afterStep, error } = await executeStep(flow);
  if (!afterStep) {
    return { status: null, error: error ?? "Erro ao executar etapa." };
  }

  return { status: buildMasterFlowStatusView(afterStep), error };
}

export async function getFlowStatus(flowId?: string): Promise<{
  status: MasterFlowStatusView | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { status: null, error: "Usuário não autenticado." };

  const repo = new MasterFlowRepository(ctx.supabase, ctx.userId);
  const { data: flow, error } = flowId
    ? await repo.findById(flowId)
    : await repo.findLatest();

  if (error || !flow) {
    return { status: null, error: error ?? "Nenhum fluxo encontrado." };
  }

  return { status: buildMasterFlowStatusView(flow), error: null };
}

export async function runFullFlow(flowId?: string): Promise<{
  status: MasterFlowStatusView | null;
  error: string | null;
}> {
  let lastStatus: MasterFlowStatusView | null = null;
  let lastError: string | null = null;

  for (let i = 0; i < MASTER_FLOW_MAX_ITERATIONS; i += 1) {
    const { status, error } = await runNextStep(flowId ?? lastStatus?.flow.id);
    if (!status) return { status: null, error: error ?? lastError };

    lastStatus = status;
    lastError = error;

    if (status.isComplete || status.flow.status === "failed") {
      break;
    }
  }

  return { status: lastStatus, error: lastError };
}

const MASTER_FLOW_MAX_ITERATIONS = 16;
