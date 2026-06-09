import OpenAI from "openai";
import {
  CreatorChecklistRepository,
  CreatorProductsRepository,
  CreatorValidationRepository,
} from "@/lib/supabase/repositories/creator.repository";
import { CreatorResearchRepository } from "@/lib/supabase/repositories/research.repository";
import { getLegacyContext } from "@/lib/supabase/services/legado.service";
import type { CreatorProduct, CreatorResearch, TableInsert } from "@/types/database";
import {
  computeRoi,
  scoreNicheAlignment,
  type CreatorProductBundle,
} from "@/utils/creator";
import {
  buildResearchAuraContext,
  computeResearchDashboard,
  parseJsonStringArray,
  type GeneratedMarketResearch,
  type ResearchDashboardMetrics,
  type ResearchIntake,
} from "@/utils/research";
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

async function callResearchAi<T>(system: string, user: string): Promise<T | null> {
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

export async function loadResearchRecords(): Promise<{
  records: CreatorResearch[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { records: [], error: "Usuário não autenticado." };

  const repo = new CreatorResearchRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findAllOrdered();
  if (error) return { records: [], error };
  return { records: data ?? [], error: null };
}

export async function getResearchDashboard(): Promise<{
  dashboard: ResearchDashboardMetrics | null;
  records: CreatorResearch[];
  error: string | null;
}> {
  const { records, error } = await loadResearchRecords();
  if (error) return { dashboard: null, records: [], error };
  return {
    dashboard: computeResearchDashboard(records),
    records,
    error: null,
  };
}

export async function getResearchContext(): Promise<{ context: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { context: "", error: "Usuário não autenticado." };

  const [{ records }, legacy] = await Promise.all([
    loadResearchRecords(),
    getLegacyContext(),
  ]);

  const lines = [
    "## AURA MARKET RESEARCH",
    buildResearchAuraContext(records),
    legacy.context ? `## LEGADO\n${legacy.context}` : "",
  ].filter(Boolean);

  return { context: lines.join("\n\n"), error: legacy.error };
}

export async function analyzeMarketOpportunity(input: ResearchIntake): Promise<{
  record: CreatorResearch | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { record: null, error: "Usuário não autenticado." };
  if (!getOpenAi()) return { record: null, error: "IA indisponível (OPENAI_API_KEY)." };

  const legacy = await getLegacyContext();
  const nicheBoost = scoreNicheAlignment(input.nicho);

  const generated = await callResearchAi<GeneratedMarketResearch>(
    `Você é a Aura Market Research — valida oportunidades antes da criação de produtos digitais.
Priorize nichos alinhados a Anderson: esporte, dança, teatro, desenvolvimento pessoal, empreendedorismo, bartender, IA e produtividade.
Responda APENAS JSON:
{
  "nicho": string,
  "publico": string,
  "problema": string,
  "solucao": string,
  "concorrencia_analise": string,
  "facilidade_criacao": number,
  "facilidade_venda": number,
  "demanda": number,
  "competicao": number,
  "escalabilidade": number,
  "potencial_lucro": number,
  "compatibilidade_perfil": number,
  "nota_final": number,
  "avatar": string,
  "dores": string[],
  "desejos": string[],
  "objecoes": string[],
  "produtos_concorrentes": string[],
  "diferencial_sugerido": string,
  "faixa_preco_min": number,
  "faixa_preco_max": number
}
Scores 0-100. competicao: quanto MAIOR, mais CONCORRIDO (invertido na nota).
nota_final = média ponderada (demanda, potencial_lucro, compatibilidade_perfil peso 1.3).`,
    JSON.stringify({
      intake: input,
      legacyContext: legacy.context ?? null,
      nicheAlignmentHint: nicheBoost,
    })
  );

  if (!generated?.nota_final) {
    return { record: null, error: "Não foi possível analisar a oportunidade." };
  }

  const compat = Math.min(
    100,
    Math.round((generated.compatibilidade_perfil + nicheBoost) / 2)
  );

  const repo = new CreatorResearchRepository(ctx.supabase, ctx.userId);
  const { data: record, error: createError } = await repo.create({
    ideia_input: input.ideia,
    nicho: generated.nicho || input.nicho,
    publico: generated.publico || input.publico,
    problema: generated.problema,
    solucao: generated.solucao,
    concorrencia_analise: generated.concorrencia_analise,
    facilidade_criacao: generated.facilidade_criacao,
    facilidade_venda: generated.facilidade_venda,
    demanda: generated.demanda,
    competicao: generated.competicao,
    escalabilidade: generated.escalabilidade,
    potencial_lucro: generated.potencial_lucro,
    compatibilidade_perfil: compat,
    nota_final: generated.nota_final,
    avatar: generated.avatar,
    dores: generated.dores,
    desejos: generated.desejos,
    objecoes: generated.objecoes,
    produtos_concorrentes: generated.produtos_concorrentes,
    diferencial_sugerido: generated.diferencial_sugerido,
    faixa_preco_min: generated.faixa_preco_min,
    faixa_preco_max: generated.faixa_preco_max,
  } satisfies Omit<TableInsert<"creator_research">, "user_id">);

  if (createError || !record) {
    return { record: null, error: createError ?? "Erro ao salvar pesquisa." };
  }

  return { record: record as CreatorResearch, error: null };
}

export async function createProductFromResearch(researchId: string): Promise<{
  bundle: CreatorProductBundle | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { bundle: null, error: "Usuário não autenticado." };

  const researchRepo = new CreatorResearchRepository(ctx.supabase, ctx.userId);
  const { data: research, error: researchError } = await researchRepo.findById(researchId);
  if (researchError || !research) {
    return { bundle: null, error: researchError ?? "Pesquisa não encontrada." };
  }

  if (research.product_id) {
    return { bundle: null, error: "Esta pesquisa já foi convertida em produto." };
  }

  const dores = parseJsonStringArray(research.dores).join("; ");
  const nome =
    research.ideia_input?.slice(0, 80) ||
    `${research.nicho ?? "Produto"} — ${research.diferencial_sugerido?.slice(0, 40) ?? "digital"}`;

  const investimento = (research.faixa_preco_min ?? 0) * 0.15;
  const receita =
    ((research.faixa_preco_min ?? 0) + (research.faixa_preco_max ?? 0)) / 2 *
    ((research.nota_final ?? 50) / 100) *
    10;

  const productsRepo = new CreatorProductsRepository(ctx.supabase, ctx.userId);
  const { data: product, error: createError } = await productsRepo.create({
    status: "pesquisa",
    nicho: research.nicho,
    conhecimento: research.diferencial_sugerido,
    publico_alvo_input: research.publico,
    used_aura_data: false,
    nome,
    problema: research.problema,
    solucao: research.solucao,
    avatar: research.avatar,
    publico_alvo: research.publico,
    promessa: research.solucao,
    mecanismo_unico: research.diferencial_sugerido,
    diferenciais: research.diferencial_sugerido,
    faixa_preco_min: research.faixa_preco_min,
    faixa_preco_max: research.faixa_preco_max,
    probabilidade_venda: research.nota_final,
    investimento_previsto: investimento > 0 ? investimento : null,
    receita_prevista: receita > 0 ? receita : null,
    roi_estimado: computeRoi(investimento, receita),
  } satisfies Omit<TableInsert<"creator_products">, "user_id">);

  if (createError || !product) {
    return { bundle: null, error: createError ?? "Erro ao criar produto." };
  }

  const productId = (product as CreatorProduct).id;

  if (research.nota_final != null) {
    await new CreatorValidationRepository(ctx.supabase, ctx.userId).upsertForProduct(
      productId,
      {
        viabilidade: research.demanda,
        lucro_potencial: research.potencial_lucro,
        tempo_lancar: research.facilidade_criacao,
        compatibilidade_perfil: research.compatibilidade_perfil ?? 50,
        escalabilidade: research.escalabilidade ?? 50,
        nota_final: research.nota_final,
        demanda: research.demanda ?? 50,
        concorrencia: research.competicao ?? 50,
        facilidade_criacao: research.facilidade_criacao ?? 50,
        facilidade_venda: research.facilidade_venda ?? 50,
      }
    );
  }

  const checklistRepo = new CreatorChecklistRepository(ctx.supabase, ctx.userId);
  await checklistRepo.seedForProduct(productId);

  await researchRepo.update(researchId, { product_id: productId });

  const { data: checklist } = await checklistRepo.findByProductId(productId);
  const { data: validation } = await new CreatorValidationRepository(
    ctx.supabase,
    ctx.userId
  ).findByProductId(productId);

  return {
    bundle: {
      product: product as CreatorProduct,
      validation,
      offer: null,
      launch: null,
      checklist: checklist ?? [],
    },
    error: null,
  };
}

export async function deleteResearchRecord(id: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new CreatorResearchRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.delete(id);
  return { error };
}
