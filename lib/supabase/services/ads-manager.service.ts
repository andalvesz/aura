import OpenAI from "openai";
import { CreatorAdsCampaignsRepository } from "@/lib/supabase/repositories/creator-ads.repository";
import { loadCopylabRecords } from "@/lib/supabase/services/copylab.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import { loadStudioAssets } from "@/lib/supabase/services/creative-studio.service";
import { loadLandingRecords } from "@/lib/supabase/services/landing-builder.service";
import { loadLaunchPlans } from "@/lib/supabase/services/launch.service";
import { loadResearchRecords } from "@/lib/supabase/services/research.service";
import type {
  CreatorAdsCampaign,
  CreatorAsset,
  CreatorLanding,
  TableInsert,
} from "@/types/database";
import {
  buildAdsAuraContext,
  computeAdsDashboard,
  type AdsDashboardMetrics,
  type AdsIntake,
  type GeneratedAdsCampaign,
} from "@/utils/ads-manager";
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

async function callAdsAi<T>(system: string, user: string): Promise<T | null> {
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

const SYSTEM_PROMPT = `Você é a Aura Ads Manager — estrategista de Meta Ads no Brasil.
Monte campanhas COMPLETAS em RASCUNHO (nunca publique).
Responda APENAS JSON:
{
  "objetivo": "conversao" | "leads" | "trafego" | "engajamento",
  "orcamento_nivel": "baixo" | "medio" | "escala",
  "investimento_diario_min": number,
  "investimento_diario_max": number,
  "investimento_mensal_previsto": number,
  "campanha_nome": string,
  "campanha_estrategia": string,
  "publicos": [
    { "tipo": "interesse" | "lookalike" | "remarketing", "nome": string, "targeting": string, "justificativa": string }
  ],
  "conjuntos_anuncios": [
    { "nome": string, "publico": string, "orcamento_diario": number, "posicionamentos": string, "estrategia": string }
  ],
  "anuncios": [
    { "nome": string, "headline": string, "texto_principal": string, "descricao": string, "cta": string, "formato": string, "conjunto": string }
  ]
}
Regras:
- Sugira 3 públicos: interesse, lookalike e remarketing
- Use SOMENTE o orçamento disponível informado pelo usuário — nunca R$ 2.000 ou valores padrão
- Se não houver orçamento informado, não preencha investimento_* — retorne zeros e explique na estrategia que falta orçamento
- investimento_mensal_previsto deve respeitar o teto do orçamento disponível
- Mínimo 2 conjuntos de anúncios e 3 anúncios
- Use copy dos criativos/landing quando disponível
- Português do Brasil, estratégia prática`;

async function loadModuleContext(): Promise<{
  creatorSummary: string;
  researchSummary: string;
  copylabSummary: string;
  studioSummary: string;
  landingSummary: string;
  launchSummary: string;
}> {
  const [
    { bundles },
    { records: researchRecords },
    { records: copyRecords },
    { records: assets },
    { records: landings },
    launch,
  ] = await Promise.all([
    loadCreatorBundles(),
    loadResearchRecords(),
    loadCopylabRecords(),
    loadStudioAssets(),
    loadLandingRecords(),
    loadLaunchPlans(),
  ]);

  const creatorSummary =
    bundles.length > 0
      ? bundles
          .slice(0, 4)
          .map(
            (b) =>
              `• ${b.product.nome ?? "Produto"} — ${b.product.problema?.slice(0, 60) ?? "sem problema"}`
          )
          .join("\n")
      : "Nenhum produto no Creator.";

  const researchSummary =
    researchRecords.length > 0
      ? researchRecords
          .slice(0, 3)
          .map((r) => `• ${r.nicho ?? r.ideia_input ?? "—"} · nota ${r.nota_final ?? "—"}`)
          .join("\n")
      : "Nenhuma pesquisa de mercado.";

  const copylabSummary =
    copyRecords.length > 0
      ? copyRecords
          .slice(0, 3)
          .map((c) => `• ${c.nome ?? c.headline ?? "—"} — ${c.headline?.slice(0, 50) ?? "—"}`)
          .join("\n")
      : "Nenhuma copy no CopyLab.";

  const studioSummary =
    assets.length > 0
      ? assets
          .slice(0, 3)
          .map(
            (a) =>
              `• ${a.nome ?? "—"} — FB: ${a.criativo_facebook?.slice(0, 40) ?? "—"} · IG: ${a.criativo_instagram?.slice(0, 40) ?? "—"}`
          )
          .join("\n")
      : "Nenhum ativo no Creative Studio.";

  const landingSummary =
    landings.length > 0
      ? landings
          .slice(0, 3)
          .map((l) => `• ${l.nome ?? "—"} — ${l.headline?.slice(0, 50) ?? "—"}`)
          .join("\n")
      : "Nenhuma landing no Landing Builder.";

  const launchSummary =
    launch.plans.length > 0
      ? launch.plans
          .slice(0, 3)
          .map((p) => `• ${p.titulo ?? "—"} · estágio ${p.estagio_atual ?? "—"}`)
          .join("\n")
      : "Nenhum plano no Launch Center.";

  return {
    creatorSummary,
    researchSummary,
    copylabSummary,
    studioSummary,
    landingSummary,
    launchSummary,
  };
}

function resolveLinkedContext(
  assetId: string | null | undefined,
  landingId: string | null | undefined,
  assets: CreatorAsset[],
  landings: CreatorLanding[]
): { asset: CreatorAsset | null; landing: CreatorLanding | null } {
  const asset = assetId ? (assets.find((a) => a.id === assetId) ?? null) : null;
  const landing = landingId ? (landings.find((l) => l.id === landingId) ?? null) : null;
  return { asset, landing };
}

export async function loadAdsCampaigns(): Promise<{
  records: CreatorAdsCampaign[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { records: [], error: "Usuário não autenticado." };

  const repo = new CreatorAdsCampaignsRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findAllOrdered();
  if (error) return { records: [], error };
  return { records: data ?? [], error: null };
}

export async function getAdsDashboard(): Promise<{
  dashboard: AdsDashboardMetrics | null;
  records: CreatorAdsCampaign[];
  assets: CreatorAsset[];
  landings: CreatorLanding[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      dashboard: null,
      records: [],
      assets: [],
      landings: [],
      error: "Usuário não autenticado.",
    };
  }

  const [{ records, error }, { records: assets }, { records: landings }] = await Promise.all([
    loadAdsCampaigns(),
    loadStudioAssets(),
    loadLandingRecords(),
  ]);

  if (error) {
    return { dashboard: null, records: [], assets: [], landings: [], error };
  }

  return {
    dashboard: computeAdsDashboard(records),
    records,
    assets,
    landings,
    error: null,
  };
}

export async function getAdsContext(): Promise<{ context: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { context: "", error: "Usuário não autenticado." };

  const [{ records }, moduleCtx] = await Promise.all([loadAdsCampaigns(), loadModuleContext()]);

  const lines = [
    "## AURA ADS MANAGER",
    buildAdsAuraContext(records),
    "Modo: APENAS RASCUNHO — campanhas não são publicadas automaticamente.",
    `## CREATOR\n${moduleCtx.creatorSummary}`,
    `## RESEARCH\n${moduleCtx.researchSummary}`,
    `## COPYLAB\n${moduleCtx.copylabSummary}`,
    `## CREATIVE STUDIO\n${moduleCtx.studioSummary}`,
    `## LANDING BUILDER\n${moduleCtx.landingSummary}`,
    `## LAUNCH CENTER\n${moduleCtx.launchSummary}`,
  ].filter(Boolean);

  return { context: lines.join("\n\n"), error: null };
}

export async function generateAdsCampaign(
  input: AdsIntake
): Promise<{ record: CreatorAdsCampaign | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { record: null, error: "Usuário não autenticado." };
  if (!getOpenAi()) return { record: null, error: "IA indisponível (OPENAI_API_KEY)." };

  if (!input.nome.trim() && !input.problema.trim()) {
    return { record: null, error: "Informe o nome ou o problema do produto." };
  }

  const orcamentoDisponivel = parseBudgetInput(input.orcamento_disponivel ?? null);
  if (orcamentoDisponivel == null) {
    return {
      record: null,
      error: "Informe seu Orçamento disponível antes de gerar a campanha.",
    };
  }

  const [moduleCtx, { records: assets }, { records: landings }] = await Promise.all([
    loadModuleContext(),
    loadStudioAssets(),
    loadLandingRecords(),
  ]);

  const { asset, landing } = resolveLinkedContext(
    input.asset_id,
    input.landing_id,
    assets,
    landings
  );

  const generated = await callAdsAi<GeneratedAdsCampaign>(
    `${SYSTEM_PROMPT}\n\n${buildBudgetAiRules(orcamentoDisponivel)}`,
    JSON.stringify({
      intake: input,
      orcamento_disponivel: orcamentoDisponivel,
      objetivoPreferido: input.objetivo,
      orcamentoPreferido: input.orcamento_nivel,
      criativoVinculado: asset
        ? {
            facebook: asset.criativo_facebook,
            instagram: asset.criativo_instagram,
            mockup: asset.mockup_produto,
          }
        : null,
      landingVinculada: landing
        ? {
            headline: landing.headline,
            subheadline: landing.subheadline,
            cta: landing.cta,
            url_sugerida: `/landing/${landing.id}`,
          }
        : null,
      creatorContext: moduleCtx.creatorSummary,
      researchContext: moduleCtx.researchSummary,
      copylabContext: moduleCtx.copylabSummary,
      studioContext: moduleCtx.studioSummary,
      landingContext: moduleCtx.landingSummary,
      launchContext: moduleCtx.launchSummary,
    })
  );

  if (!generated?.campanha_nome) {
    return { record: null, error: "Não foi possível gerar a campanha." };
  }

  const budgetInvestimento = computeInvestimentoFromBudget(orcamentoDisponivel);
  const investimentoMensal = clampInvestimentoToBudget(
    generated.investimento_mensal_previsto,
    orcamentoDisponivel
  );

  const repo = new CreatorAdsCampaignsRepository(ctx.supabase, ctx.userId);

  const payload = {
    status: "draft" as const,
    product_id: input.product_id ?? null,
    asset_id: input.asset_id ?? null,
    landing_id: input.landing_id ?? null,
    copylab_id: input.copylab_id ?? null,
    nome: input.nome || null,
    avatar: input.avatar || null,
    problema: input.problema || null,
    solucao: input.solucao || null,
    promessa: input.promessa || null,
    diferencial: input.diferencial || null,
    preco: input.preco,
    objetivo: generated.objetivo,
    orcamento_nivel: budgetInvestimento.orcamento_nivel,
    orcamento_disponivel: orcamentoDisponivel,
    investimento_diario_min: budgetInvestimento.investimento_diario_min,
    investimento_diario_max: budgetInvestimento.investimento_diario_max,
    investimento_mensal_previsto: investimentoMensal ?? budgetInvestimento.investimento_mensal_previsto,
    campanha_nome: generated.campanha_nome,
    campanha_estrategia: generated.campanha_estrategia,
    publicos: generated.publicos,
    conjuntos_anuncios: generated.conjuntos_anuncios,
    anuncios: generated.anuncios,
  } satisfies Omit<TableInsert<"creator_ads_campaigns">, "user_id">;

  if (input.campaign_id) {
    const { data: updated, error: updateError } = await repo.update(input.campaign_id, payload);
    if (updateError || !updated) {
      return { record: null, error: updateError ?? "Erro ao atualizar campanha." };
    }
    return { record: updated as CreatorAdsCampaign, error: null };
  }

  const { data: record, error: createError } = await repo.create(payload);
  if (createError || !record) {
    return { record: null, error: createError ?? "Erro ao salvar campanha." };
  }

  return { record: record as CreatorAdsCampaign, error: null };
}

export async function deleteAdsCampaign(id: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new CreatorAdsCampaignsRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.delete(id);
  return { error };
}
