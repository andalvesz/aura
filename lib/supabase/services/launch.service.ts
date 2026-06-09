import OpenAI from "openai";
import { FinancialGoalsRepository } from "@/lib/supabase/repositories/financial-goals.repository";
import { GoalsRepository } from "@/lib/supabase/repositories/goals.repository";
import { CreatorLaunchPlansRepository } from "@/lib/supabase/repositories/launch.repository";
import { loadCopylabRecords } from "@/lib/supabase/services/copylab.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import { getLegacyContext } from "@/lib/supabase/services/legado.service";
import { loadResearchRecords } from "@/lib/supabase/services/research.service";
import type { CreatorLaunchPlan, TableInsert } from "@/types/database";
import {
  buildLaunchAuraContext,
  buildLaunchCenterData,
  computeLaunchDashboard,
  LAUNCH_PIPELINE_STEPS,
  type GeneratedLaunchPlan,
  type LaunchCenterData,
  type LaunchDashboardMetrics,
} from "@/utils/launch";
import { rankProductsForLaunch } from "@/utils/creator";
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

async function callLaunchAi<T>(system: string, user: string): Promise<T | null> {
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

async function getFinanceContext(): Promise<string> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return "";

  const goalsRepo = new FinancialGoalsRepository(ctx.supabase, ctx.userId);
  const { data: goals } = await goalsRepo.findAll("data_fim");
  if (!goals?.length) return "Nenhuma meta financeira cadastrada.";

  return goals
    .slice(0, 5)
    .map(
      (g) =>
        `• ${g.titulo}: meta ${g.valor_meta} · atual ${g.valor_atual} (${g.data_inicio} → ${g.data_fim})`
    )
    .join("\n");
}

async function getMetasContext(): Promise<string> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return "";

  const today = new Date().toISOString().slice(0, 10);
  const goalsRepo = new GoalsRepository(ctx.supabase, ctx.userId);
  const { data: goals } = await goalsRepo.findActive(today);
  const vendas = (goals ?? []).filter((g) => g.tipo === "vendas" || g.tipo === "financeira");

  if (!vendas.length) return "Nenhuma meta de vendas ativa.";

  return vendas
    .slice(0, 5)
    .map((g) => `• ${g.titulo}: ${g.atual}/${g.meta} (${g.data_inicio} → ${g.data_fim})`)
    .join("\n");
}

export async function loadLaunchPlans(): Promise<{
  plans: CreatorLaunchPlan[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { plans: [], error: "Usuário não autenticado." };

  const repo = new CreatorLaunchPlansRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findAllOrdered();
  if (error) return { plans: [], error };
  return { plans: data ?? [], error: null };
}

async function loadLaunchCenterState(): Promise<{
  center: LaunchCenterData;
  plans: CreatorLaunchPlan[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      center: buildLaunchCenterData([], [], [], []),
      plans: [],
      error: "Usuário não autenticado.",
    };
  }

  const [{ bundles }, { records: research }, { records: copy }, { plans }] =
    await Promise.all([
      loadCreatorBundles(),
      loadResearchRecords(),
      loadCopylabRecords(),
      loadLaunchPlans(),
    ]);

  const center = buildLaunchCenterData(bundles, research, copy, plans);
  return { center, plans, error: null };
}

export async function getLaunchDashboard(): Promise<{
  dashboard: LaunchDashboardMetrics | null;
  center: LaunchCenterData | null;
  plans: CreatorLaunchPlan[];
  error: string | null;
}> {
  const { center, plans, error } = await loadLaunchCenterState();
  if (error) return { dashboard: null, center: null, plans: [], error };

  return {
    dashboard: computeLaunchDashboard(center, plans),
    center,
    plans,
    error: null,
  };
}

export async function getLaunchContext(): Promise<{ context: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { context: "", error: "Usuário não autenticado." };

  const [{ center, plans }, legacy, financeContext, metasContext] = await Promise.all([
    loadLaunchCenterState(),
    getLegacyContext(),
    getFinanceContext(),
    getMetasContext(),
  ]);

  const lines = [
    "## AURA LAUNCH CENTER",
    buildLaunchAuraContext(center, plans),
    legacy.context ? `## LEGADO\n${legacy.context}` : "",
    financeContext ? `## FINANCEIRO\n${financeContext}` : "",
    metasContext ? `## METAS\n${metasContext}` : "",
  ].filter(Boolean);

  return { context: lines.join("\n\n"), error: legacy.error };
}

export async function startLaunch(productId?: string): Promise<{
  plan: CreatorLaunchPlan | null;
  center: LaunchCenterData | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { plan: null, center: null, error: "Usuário não autenticado." };
  if (!getOpenAi()) return { plan: null, center: null, error: "IA indisponível (OPENAI_API_KEY)." };

  const [{ bundles }, { records: research }, { records: copy }, legacy, financeContext, metasContext] =
    await Promise.all([
      loadCreatorBundles(),
      loadResearchRecords(),
      loadCopylabRecords(),
      getLegacyContext(),
      getFinanceContext(),
      getMetasContext(),
    ]);

  const bundle = productId
    ? bundles.find((b) => b.product.id === productId)
    : rankProductsForLaunch(bundles)[0];

  if (!bundle) {
    return {
      plan: null,
      center: null,
      error: "Nenhum produto encontrado. Crie um produto no Creator primeiro.",
    };
  }

  const linkedResearch = research.find((r) => r.product_id === bundle.product.id) ?? null;
  const linkedCopy = copy.find((c) => c.product_id === bundle.product.id) ?? null;

  const generated = await callLaunchAi<GeneratedLaunchPlan>(
    `Você é a Aura Launch Center — orquestra Research, Creator e CopyLab.
Crie plano de lançamento completo com tarefas, cronograma e prioridades.
Responda APENAS JSON:
{
  "titulo": string,
  "estagio_atual": string,
  "score_ia": number,
  "receita_estimada": number,
  "data_prevista_lancamento": string,
  "tarefas": string[],
  "cronograma": [{ "semana": number, "foco": string, "tarefas": string[] }],
  "prioridades": string[]
}
Regras:
- 4 semanas no cronograma, 3-5 tarefas por semana
- 5-8 tarefas imediatas em "tarefas"
- 3-5 prioridades ordenadas
- data_prevista_lancamento em formato YYYY-MM-DD (30 dias a partir de hoje)
- score_ia 0-100 baseado na validação
- receita_estimada em reais
- estagio_atual: um de ${LAUNCH_PIPELINE_STEPS.map((s) => s.label).join(", ")}
- Português do Brasil`,
    JSON.stringify({
      product: bundle.product,
      validation: bundle.validation,
      launch: bundle.launch,
      research: linkedResearch,
      copy: linkedCopy
        ? {
            headline: linkedCopy.headline,
            hasVsl: !!linkedCopy.estrutura_vsl,
            hasAds: !!linkedCopy.facebook_ad,
          }
        : null,
      legacyContext: legacy.context ?? null,
      financeContext,
      metasContext,
      pipeline: LAUNCH_PIPELINE_STEPS.map((s) => s.label),
    })
  );

  if (!generated?.titulo) {
    return { plan: null, center: null, error: "Não foi possível gerar o plano de lançamento." };
  }

  const repo = new CreatorLaunchPlansRepository(ctx.supabase, ctx.userId);
  const { data: plan, error: createError } = await repo.create({
    product_id: bundle.product.id,
    titulo: generated.titulo,
    estagio_atual: generated.estagio_atual,
    score_ia: generated.score_ia,
    receita_estimada: generated.receita_estimada,
    data_prevista_lancamento: generated.data_prevista_lancamento,
    tarefas: generated.tarefas,
    cronograma: generated.cronograma,
    prioridades: generated.prioridades,
  } satisfies Omit<TableInsert<"creator_launch_plans">, "user_id">);

  if (createError || !plan) {
    return { plan: null, center: null, error: createError ?? "Erro ao salvar plano." };
  }

  const { plans } = await loadLaunchPlans();
  const center = buildLaunchCenterData(bundles, research, copy, plans);

  return { plan: plan as CreatorLaunchPlan, center, error: null };
}

export async function deleteLaunchPlan(id: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new CreatorLaunchPlansRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.delete(id);
  return { error };
}
