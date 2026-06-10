import OpenAI from "openai";
import { CreatorCampaignOrchestrationsRepository } from "@/lib/supabase/repositories/campaign-orchestrator.repository";
import { generateAdsCampaign, loadAdsCampaigns } from "@/lib/supabase/services/ads-manager.service";
import { loadCopylabRecords } from "@/lib/supabase/services/copylab.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import { loadStudioAssets } from "@/lib/supabase/services/creative-studio.service";
import { loadLandingRecords } from "@/lib/supabase/services/landing-builder.service";
import { loadResearchRecords } from "@/lib/supabase/services/research.service";
import type {
  CreatorAdsCampaign,
  CreatorAsset,
  CreatorCampaignOrchestration,
  CreatorCopylab,
  CreatorLanding,
  CreatorResearch,
  TableInsert,
} from "@/types/database";
import type { CreatorProductBundle } from "@/utils/creator";
import { intakeFromProductBundle as adsIntakeFromBundle } from "@/utils/ads-manager";
import {
  buildOrchestratorAuraContext,
  buildOrchestratorCenterData,
  computeOrchestratorDashboard,
  type GeneratedOrchestration,
  type OrchestratorCenterData,
  type OrchestratorConnections,
  type OrchestratorDashboardMetrics,
  type OrchestratorIntake,
  ORCHESTRATOR_STEPS,
} from "@/utils/campaign-orchestrator";
import {
  buildBudgetAiRules,
  clampInvestimentoToBudget,
  computeInvestimentoFromBudget,
  parseBudgetInput,
} from "@/utils/campaign-budget";
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

async function callOrchestratorAi<T>(system: string, user: string): Promise<T | null> {
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

const SYSTEM_PROMPT = `Você é a Aura Campaign Orchestrator — prepara campanhas completas para lançamento.
Conecte criativos, landing e anúncios; calcule orçamento, ROI e plano de lançamento.
NUNCA publique anúncios — apenas estruture em rascunho.
Responda APENAS JSON:
{
  "score_lancamento": number,
  "probabilidade_sucesso": number,
  "investimento_necessario": number,
  "receita_prevista": number,
  "roi_estimado": number,
  "orcamento_sugerido": {
    "nivel": "baixo" | "medio" | "escala",
    "diario_min": number,
    "diario_max": number,
    "mensal": number,
    "justificativa": string
  },
  "plano_lancamento": {
    "titulo": string,
    "fases": [{ "nome": string, "duracao_dias": number, "acoes": string[] }],
    "cronograma": [{ "dia": number, "foco": string, "tarefas": string[] }],
    "prioridades": string[]
  },
  "riscos": [
    { "nivel": "baixo" | "medio" | "alto", "descricao": string, "mitigacao": string }
  ],
  "resumo": string
}
Regras:
- score_lancamento e probabilidade_sucesso: 0-100
- roi_estimado em percentual (ex: 150 = 150% ROI)
- 3-4 fases no plano, cronograma de 14 dias
- 3-5 riscos com mitigação
- Use SOMENTE o orçamento disponível informado — nunca R$ 2.000 ou valores padrão
- Português do Brasil, estratégia prática`;

function resolveLinkedArtifacts(
  bundle: CreatorProductBundle,
  researchRecords: CreatorResearch[],
  copyRecords: CreatorCopylab[],
  assets: CreatorAsset[],
  landings: CreatorLanding[],
  adsCampaigns: CreatorAdsCampaign[]
): OrchestratorConnections & {
  research: CreatorResearch | null;
  copy: CreatorCopylab | null;
  asset: CreatorAsset | null;
  landing: CreatorLanding | null;
  adsCampaign: CreatorAdsCampaign | null;
} {
  const pid = bundle.product.id;
  const research = researchRecords.find((r) => r.product_id === pid) ?? null;
  const copy = copyRecords.find((c) => c.product_id === pid) ?? null;
  const asset = assets.find((a) => a.product_id === pid) ?? null;
  const landing = landings.find((l) => l.product_id === pid) ?? null;
  const adsCampaign = adsCampaigns.find((a) => a.product_id === pid) ?? null;

  return {
    research_id: research?.id ?? null,
    copylab_id: copy?.id ?? null,
    asset_id: asset?.id ?? null,
    landing_id: landing?.id ?? null,
    ads_campaign_id: adsCampaign?.id ?? null,
    research,
    copy,
    asset,
    landing,
    adsCampaign,
  };
}

export async function loadOrchestrations(): Promise<{
  records: CreatorCampaignOrchestration[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { records: [], error: "Usuário não autenticado." };

  const repo = new CreatorCampaignOrchestrationsRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findAllOrdered();
  if (error) return { records: [], error };
  return { records: data ?? [], error: null };
}

async function loadOrchestratorState(productId?: string | null): Promise<{
  center: OrchestratorCenterData;
  records: CreatorCampaignOrchestration[];
  bundles: CreatorProductBundle[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      center: buildOrchestratorCenterData([], [], [], [], [], [], []),
      records: [],
      bundles: [],
      error: "Usuário não autenticado.",
    };
  }

  const [
    { bundles },
    { records: research },
    { records: copy },
    { records: assets },
    { records: landings },
    { records: adsCampaigns },
    { records: orchestrations },
  ] = await Promise.all([
    loadCreatorBundles(),
    loadResearchRecords(),
    loadCopylabRecords(),
    loadStudioAssets(),
    loadLandingRecords(),
    loadAdsCampaigns(),
    loadOrchestrations(),
  ]);

  const center = buildOrchestratorCenterData(
    bundles,
    research,
    copy,
    assets,
    landings,
    adsCampaigns,
    orchestrations,
    productId
  );

  return { center, records: orchestrations, bundles, error: null };
}

export async function getOrchestratorDashboard(productId?: string | null): Promise<{
  dashboard: OrchestratorDashboardMetrics | null;
  center: OrchestratorCenterData | null;
  records: CreatorCampaignOrchestration[];
  bundles: CreatorProductBundle[];
  error: string | null;
}> {
  const { center, records, bundles, error } = await loadOrchestratorState(productId);
  if (error) {
    return { dashboard: null, center: null, records: [], bundles: [], error };
  }

  return {
    dashboard: computeOrchestratorDashboard(center),
    center,
    records,
    bundles,
    error: null,
  };
}

export async function getOrchestratorContext(): Promise<{ context: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { context: "", error: "Usuário não autenticado." };

  const { center, records } = await loadOrchestratorState();

  const lines = [
    "## AURA CAMPAIGN ORCHESTRATOR",
    buildOrchestratorAuraContext(center, records),
    "Modo: APENAS PREPARAÇÃO — anúncios não são publicados automaticamente.",
  ].filter(Boolean);

  return { context: lines.join("\n\n"), error: null };
}

export async function prepareLaunch(
  input: OrchestratorIntake
): Promise<{
  orchestration: CreatorCampaignOrchestration | null;
  center: OrchestratorCenterData | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { orchestration: null, center: null, error: "Usuário não autenticado." };
  if (!getOpenAi()) {
    return { orchestration: null, center: null, error: "IA indisponível (OPENAI_API_KEY)." };
  }

  if (!input.product_id?.trim()) {
    return { orchestration: null, center: null, error: "Selecione um produto." };
  }

  const orcamentoDisponivel = parseBudgetInput(input.orcamento_disponivel ?? null);
  if (orcamentoDisponivel == null) {
    return {
      orchestration: null,
      center: null,
      error: "Informe seu Orçamento disponível antes de preparar o lançamento.",
    };
  }

  const [
    { bundles },
    { records: research },
    { records: copy },
    { records: assets },
    { records: landings },
    { records: adsCampaigns },
  ] = await Promise.all([
    loadCreatorBundles(),
    loadResearchRecords(),
    loadCopylabRecords(),
    loadStudioAssets(),
    loadLandingRecords(),
    loadAdsCampaigns(),
  ]);

  const bundle = bundles.find((b) => b.product.id === input.product_id);
  if (!bundle) {
    return { orchestration: null, center: null, error: "Produto não encontrado." };
  }

  const linked = resolveLinkedArtifacts(bundle, research, copy, assets, landings, adsCampaigns);

  let adsCampaign = linked.adsCampaign;

  if (!adsCampaign && linked.asset && linked.landing) {
    const adsIntake = {
      ...adsIntakeFromBundle(bundle),
      copylab_id: linked.copylab_id,
      asset_id: linked.asset_id,
      landing_id: linked.landing_id,
      objetivo: "conversao" as const,
      orcamento_nivel: computeInvestimentoFromBudget(orcamentoDisponivel).orcamento_nivel,
      orcamento_disponivel: orcamentoDisponivel,
    };

    const { record: generatedAds, error: adsError } = await generateAdsCampaign(adsIntake);
    if (generatedAds) {
      adsCampaign = generatedAds;
      linked.ads_campaign_id = generatedAds.id;
    } else if (adsError) {
      console.warn("[orchestrator] ads generation:", adsError);
    }
  } else if (adsCampaign && (!adsCampaign.asset_id || !adsCampaign.landing_id)) {
    const adsIntake = {
      ...adsIntakeFromBundle(bundle),
      campaign_id: adsCampaign.id,
      copylab_id: linked.copylab_id ?? adsCampaign.copylab_id,
      asset_id: linked.asset_id ?? adsCampaign.asset_id,
      landing_id: linked.landing_id ?? adsCampaign.landing_id,
      objetivo: adsCampaign.objetivo,
      orcamento_nivel: adsCampaign.orcamento_nivel,
      orcamento_disponivel: orcamentoDisponivel,
    };

    const { record: updatedAds } = await generateAdsCampaign(adsIntake);
    if (updatedAds) {
      adsCampaign = updatedAds;
      linked.ads_campaign_id = updatedAds.id;
    }
  }

  const centerBefore = buildOrchestratorCenterData(
    bundles,
    research,
    copy,
    assets,
    landings,
    adsCampaign ? [adsCampaign, ...adsCampaigns.filter((a) => a.id !== adsCampaign!.id)] : adsCampaigns,
    [],
    input.product_id
  );

  const generated = await callOrchestratorAi<GeneratedOrchestration>(
    `${SYSTEM_PROMPT}\n\n${buildBudgetAiRules(orcamentoDisponivel)}`,
    JSON.stringify({
      product: bundle.product,
      orcamento_disponivel: orcamentoDisponivel,
      validation: bundle.validation,
      checklist: centerBefore.checklist,
      connections: {
        research: linked.research
          ? { nicho: linked.research.nicho, nota: linked.research.nota_final }
          : null,
        copy: linked.copy
          ? { headline: linked.copy.headline, hasVsl: !!linked.copy.estrutura_vsl }
          : null,
        asset: linked.asset
          ? { nome: linked.asset.nome, facebook: linked.asset.criativo_facebook?.slice(0, 80) }
          : null,
        landing: linked.landing
          ? { headline: linked.landing.headline, cta: linked.landing.cta }
          : null,
        ads: adsCampaign
          ? {
              nome: adsCampaign.campanha_nome,
              investimento: adsCampaign.investimento_mensal_previsto,
              objetivo: adsCampaign.objetivo,
            }
          : null,
      },
      pipeline: ORCHESTRATOR_STEPS.map((s) => s.label),
    })
  );

  if (!generated?.resumo) {
    return { orchestration: null, center: null, error: "Não foi possível preparar o lançamento." };
  }

  const budgetInvestimento = computeInvestimentoFromBudget(orcamentoDisponivel);
  const investimentoNecessario = clampInvestimentoToBudget(
    generated.investimento_necessario,
    orcamentoDisponivel
  );

  const connections: OrchestratorConnections = {
    research_id: linked.research_id,
    copylab_id: linked.copylab_id,
    asset_id: linked.asset_id,
    landing_id: linked.landing_id,
    ads_campaign_id: linked.ads_campaign_id,
  };

  const repo = new CreatorCampaignOrchestrationsRepository(ctx.supabase, ctx.userId);

  const payload = {
    status: "prepared" as const,
    product_id: bundle.product.id,
    research_id: connections.research_id,
    copylab_id: connections.copylab_id,
    asset_id: connections.asset_id,
    landing_id: connections.landing_id,
    ads_campaign_id: connections.ads_campaign_id,
    launch_plan_id: null,
    pipeline_step: ORCHESTRATOR_STEPS.find((s) => centerBefore.checklist[s.id] !== "concluido")?.id ?? "campanha",
    score_lancamento: generated.score_lancamento,
    probabilidade_sucesso: generated.probabilidade_sucesso,
    investimento_necessario: investimentoNecessario,
    orcamento_disponivel: orcamentoDisponivel,
    receita_prevista: generated.receita_prevista,
    roi_estimado: generated.roi_estimado,
    orcamento_sugerido: {
      ...generated.orcamento_sugerido,
      nivel: budgetInvestimento.orcamento_nivel,
      diario_min: budgetInvestimento.investimento_diario_min,
      diario_max: budgetInvestimento.investimento_diario_max,
      mensal: budgetInvestimento.investimento_mensal_previsto,
    },
    plano_lancamento: generated.plano_lancamento,
    conexoes: connections,
    riscos: generated.riscos,
    resumo: generated.resumo,
  } satisfies Omit<TableInsert<"creator_campaign_orchestrations">, "user_id">;

  if (input.orchestration_id) {
    const { data: updated, error: updateError } = await repo.update(input.orchestration_id, payload);
    if (updateError || !updated) {
      return { orchestration: null, center: null, error: updateError ?? "Erro ao atualizar orquestração." };
    }

    const { center } = await loadOrchestratorState(input.product_id);
    return { orchestration: updated as CreatorCampaignOrchestration, center, error: null };
  }

  const { data: record, error: createError } = await repo.create(payload);
  if (createError || !record) {
    return { orchestration: null, center: null, error: createError ?? "Erro ao salvar orquestração." };
  }

  const { center } = await loadOrchestratorState(input.product_id);
  return { orchestration: record as CreatorCampaignOrchestration, center, error: null };
}

export async function deleteOrchestration(id: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new CreatorCampaignOrchestrationsRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.delete(id);
  return { error };
}
