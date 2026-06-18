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
      case "market_hunter": {
        const { identifyOpportunities } = await import("./market-hunter.service");
        const { opportunities, error } = await identifyOpportunities(intent);
        if (error) return { flow: await failFlow(repo, flow, error), error };

        const top = opportunities[0];
        const { data: updated } = await repo.update(flow.id, {
          metadata: mergeMasterFlowMetadata(flow.metadata, {
            opportunity_name: top?.product_name ?? (intent.niche ? `Programa de ${intent.niche}` : "Oportunidade digital"),
            niche: top?.niche ?? intent.niche ?? null,
            country: top?.country ?? intent.country ?? null,
            language: top?.language ?? intent.language ?? null,
          }),
        });

        return { flow: await markStepCompleted(repo, updated ?? flow, step), error: null };
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
        const productName = meta.opportunity_name ?? "Negócio digital Aura";
        const { productId, error: productError } = await ensureCreatorProduct(flow, {
          name: productName,
          niche: meta.niche,
          promessa: productName,
          avatar: meta.avatar,
          country: meta.country,
          language: meta.language,
          ticket: meta.ticket,
        });
        if (productError || !productId) {
          return { flow: await failFlow(repo, flow, productError ?? "Produto não criado."), error: productError };
        }

        const { loadCreatorBundles } = await import("./creator.service");
        const { bundles } = await loadCreatorBundles();
        const bundle = bundles.find((b) => b.product.id === productId) ?? null;

        const intake = bundle
          ? factoryIntakeFromBundle(bundle)
          : {
              titulo: productName,
              promessa: productName,
              avatar: meta.avatar ?? meta.niche ?? "Empreendedor digital",
              problema: `Resolver desafios em ${meta.niche ?? "mercado digital"}`,
              solucao: productName,
              product_id: productId,
            };

        const { generateProductFactory } = await import("./product-factory.service");
        const { bundle: factoryBundle, error } = await generateProductFactory({
          ...intake,
          product_id: productId,
        });
        if (error) {
          return { flow: await failFlow(repo, flow, error), error };
        }

        const factoryId = factoryBundle?.factory.id ?? null;
        const { data: updated } = await repo.update(flow.id, {
          product_id: productId,
          metadata: mergeMasterFlowMetadata(flow.metadata, { factory_id: factoryId }),
        });

        return { flow: await markStepCompleted(repo, updated ?? flow, step), error: null };
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
          return {
            flow: await failFlow(repo, updated ?? flow, gapMsg),
            error: gapMsg,
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
    current_step: "market_hunter",
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
