import OpenAI from "openai";
import {
  CreatorChecklistRepository,
  CreatorLaunchesRepository,
  CreatorOffersRepository,
  CreatorProductsRepository,
  CreatorValidationRepository,
} from "@/lib/supabase/repositories/creator.repository";
import { FinancialGoalsRepository } from "@/lib/supabase/repositories";
import { buildAuraContext } from "@/lib/supabase/services/aura-brain.service";
import { compareNewCreatorProductWithKiwify } from "@/lib/supabase/services/kiwify-intelligence.service";
import type { KiwifyCreatorComparison } from "@/utils/kiwify-intelligence";
import type {
  CreatorLaunch,
  CreatorOffer,
  CreatorPipelineStage,
  CreatorProduct,
  CreatorValidation,
  TableInsert,
} from "@/types/database";
import {
  buildCreatorAuraContext,
  computeChecklistProgress,
  computeCreatorDashboard,
  computeRoi,
  CREATOR_PIPELINE_STAGES,
  getNextPipelineStage,
  scoreNicheAlignment,
  type CreatorProductBundle,
  type CreatorProductIntake,
  type GeneratedCreatorOffer,
  type GeneratedCreatorPlan,
  type GeneratedCreatorProduct,
  type GeneratedCreatorValidation,
} from "@/utils/creator";
import {
  buildCreatorAiContext,
  buildLocaleAiRules,
  pickLocaleFields,
  resolveCreatorLocale,
} from "@/utils/creator-locale";
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

async function callCreatorAi<T>(system: string, user: string): Promise<T | null> {
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

async function loadBundleById(productId: string): Promise<CreatorProductBundle | null> {
  const { bundles } = await loadCreatorBundles();
  return bundles.find((b) => b.product.id === productId) ?? null;
}

export async function loadCreatorBundles(): Promise<{
  bundles: CreatorProductBundle[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { bundles: [], error: "Usuário não autenticado." };
  }

  const repo = new CreatorProductsRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findAllWithRelations();
  if (error) return { bundles: [], error };
  return { bundles: data ?? [], error: null };
}

export async function getCreatorDashboard() {
  const { bundles, error } = await loadCreatorBundles();
  if (error) return { dashboard: null, bundles: [], error };
  return {
    dashboard: computeCreatorDashboard(bundles),
    bundles,
    error: null,
  };
}

export async function getCreatorContext(): Promise<{
  context: string;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { context: "", error: "Usuário não autenticado." };
  }

  const [{ bundles }, brain] = await Promise.all([
    loadCreatorBundles(),
    buildAuraContext(),
  ]);

  const lines = [
    brain.context ? brain.context : "",
    "## AURA CREATOR — Pipeline de produtos",
    buildCreatorAuraContext(bundles),
    brain.moduleData.legacy ? `## LEGADO\n${brain.moduleData.legacy}` : "",
    brain.sections.financeiro ? `## FINANCEIRO\n${brain.sections.financeiro}` : "",
  ].filter(Boolean);

  return { context: lines.join("\n\n"), error: brain.error };
}

export async function generateCreatorProduct(input: {
  intake: CreatorProductIntake;
  useAuraData: boolean;
}): Promise<{
  bundle: CreatorProductBundle | null;
  kiwifyComparison: KiwifyCreatorComparison | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { bundle: null, kiwifyComparison: null, error: "Usuário não autenticado." };
  }

  if (!getOpenAi()) {
    return { bundle: null, kiwifyComparison: null, error: "IA indisponível (OPENAI_API_KEY)." };
  }

  let auraContext = "";
  let financeContext = "";
  if (input.useAuraData) {
    const brain = await buildAuraContext();
    auraContext = brain.context || brain.moduleData.legacy;
    financeContext = brain.sections.financeiro;
  } else {
    financeContext = await getFinanceContext();
  }

  const locale = resolveCreatorLocale(input.intake);

  const generated = await callCreatorAi<GeneratedCreatorProduct>(
    `${buildCreatorAiContext(locale)}
Responda APENAS com JSON válido no formato:
{
  "nome": string,
  "problema": string,
  "solucao": string,
  "avatar": string,
  "publico_alvo": string,
  "promessa": string,
  "mecanismo_unico": string,
  "diferenciais": string,
  "faixa_preco_min": number,
  "faixa_preco_max": number,
  "formato": string,
  "probabilidade_venda": number,
  "investimento_previsto": number,
  "receita_prevista": number
}
${buildLocaleAiRules(locale)}
probabilidade_venda de 0 a 100.
Estime investimento_previsto (produção, ads, ferramentas) e receita_prevista (primeiro ciclo de vendas) em ${locale.currency}.`,
    JSON.stringify({
      intake: input.intake,
      auraContext: auraContext || null,
      financeContext: financeContext || null,
    })
  );

  if (!generated?.nome) {
    return { bundle: null, kiwifyComparison: null, error: "Não foi possível gerar o produto." };
  }

  const roi = computeRoi(generated.investimento_previsto, generated.receita_prevista);

  const productsRepo = new CreatorProductsRepository(ctx.supabase, ctx.userId);
  const { data: product, error: createError } = await productsRepo.create({
    status: "ideia",
    nicho: input.intake.nicho,
    conhecimento: input.intake.conhecimento,
    publico_alvo_input: input.intake.publico_alvo,
    objetivo_financeiro: input.intake.objetivo_financeiro,
    prazo: input.intake.prazo,
    ...pickLocaleFields(locale),
    used_aura_data: input.useAuraData,
    nome: generated.nome,
    problema: generated.problema,
    solucao: generated.solucao,
    avatar: generated.avatar,
    publico_alvo: generated.publico_alvo,
    promessa: generated.promessa,
    mecanismo_unico: generated.mecanismo_unico,
    diferenciais: generated.diferenciais,
    faixa_preco_min: generated.faixa_preco_min,
    faixa_preco_max: generated.faixa_preco_max,
    formato: generated.formato,
    probabilidade_venda: generated.probabilidade_venda,
    investimento_previsto: generated.investimento_previsto,
    receita_prevista: generated.receita_prevista,
    roi_estimado: roi,
  } satisfies Omit<TableInsert<"creator_products">, "user_id">);

  if (createError || !product) {
    return { bundle: null, kiwifyComparison: null, error: createError ?? "Erro ao salvar produto." };
  }

  const checklistRepo = new CreatorChecklistRepository(ctx.supabase, ctx.userId);
  const { data: checklist } = await checklistRepo.seedForProduct(product.id);

  const kiwifyComparison = await compareNewCreatorProductWithKiwify({
    productName: generated.nome,
    nicho: input.intake.nicho,
    precoMin: generated.faixa_preco_min,
    precoMax: generated.faixa_preco_max,
    probabilidadeVenda: generated.probabilidade_venda,
  });

  return {
    bundle: {
      product: product as CreatorProduct,
      validation: null,
      offer: null,
      launch: null,
      checklist: checklist ?? [],
    },
    kiwifyComparison,
    error: null,
  };
}

export async function validateCreatorProduct(productId: string): Promise<{
  bundle: CreatorProductBundle | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { bundle: null, error: "Usuário não autenticado." };
  }

  if (!getOpenAi()) {
    return { bundle: null, error: "IA indisponível (OPENAI_API_KEY)." };
  }

  const productsRepo = new CreatorProductsRepository(ctx.supabase, ctx.userId);
  const { data: product, error: productError } = await productsRepo.findById(productId);
  if (productError || !product) {
    return { bundle: null, error: productError ?? "Produto não encontrado." };
  }

  const brain = await buildAuraContext();
  const legacy = { context: brain.moduleData.legacy };
  const financeContext = brain.sections.financeiro;

  const nicheBoost = scoreNicheAlignment(product.nicho);
  const locale = resolveCreatorLocale(product);

  const generated = await callCreatorAi<GeneratedCreatorValidation>(
    `${buildCreatorAiContext(locale)}
Valide o produto com scores estratégicos para o mercado ${locale.target_country}.
Responda APENAS JSON:
{
  "viabilidade": number,
  "lucro_potencial": number,
  "tempo_lancar": number,
  "compatibilidade_perfil": number,
  "escalabilidade": number,
  "nota_final": number,
  "demanda": number,
  "concorrencia": number,
  "facilidade_criacao": number,
  "facilidade_venda": number
}
${buildLocaleAiRules(locale)}
Cada score de 0 a 100. tempo_lancar: quanto MAIOR, mais RÁPIDO para lançar.
nota_final = média ponderada (viabilidade, lucro_potencial, compatibilidade_perfil peso 1.3; escalabilidade 1.2).`,
    JSON.stringify({
      product,
      legacyContext: legacy.context ?? null,
      financeContext,
      nicheAlignmentHint: nicheBoost,
    })
  );

  if (generated == null || typeof generated.nota_final !== "number") {
    return { bundle: null, error: "Não foi possível validar o produto." };
  }

  const compat = Math.min(
    100,
    Math.round((generated.compatibilidade_perfil + nicheBoost) / 2)
  );

  const validationRepo = new CreatorValidationRepository(ctx.supabase, ctx.userId);
  const { data: validation, error: validationError } =
    await validationRepo.upsertForProduct(productId, {
      viabilidade: generated.viabilidade,
      lucro_potencial: generated.lucro_potencial,
      tempo_lancar: generated.tempo_lancar,
      compatibilidade_perfil: compat,
      escalabilidade: generated.escalabilidade,
      nota_final: generated.nota_final,
      demanda: generated.demanda,
      concorrencia: generated.concorrencia,
      facilidade_criacao: generated.facilidade_criacao,
      facilidade_venda: generated.facilidade_venda,
    });

  if (validationError || !validation) {
    return { bundle: null, error: validationError ?? "Erro ao salvar validação." };
  }

  const avgPrice = ((product.faixa_preco_min ?? 0) + (product.faixa_preco_max ?? 0)) / 2;
  const receitaPrevista =
    product.receita_prevista ??
    (avgPrice > 0 ? avgPrice * (generated.nota_final / 100) * 10 : null);
  const investimento = product.investimento_previsto ?? avgPrice * 0.2;
  const roi = computeRoi(investimento, receitaPrevista);

  await new CreatorLaunchesRepository(ctx.supabase, ctx.userId).upsertForProduct(
    productId,
    {
      status: "planned",
      potencial_estimado: receitaPrevista,
      ...pickLocaleFields(locale),
    }
  );

  const { data: updatedProduct, error: updateError } = await productsRepo.update(
    productId,
    {
      status: "validacao",
      receita_prevista: receitaPrevista,
      investimento_previsto: investimento,
      roi_estimado: roi,
    }
  );

  if (updateError) {
    return { bundle: null, error: updateError };
  }

  return { bundle: await loadBundleById(productId), error: null };
}

export async function generateCreatorOffer(productId: string): Promise<{
  bundle: CreatorProductBundle | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { bundle: null, error: "Usuário não autenticado." };
  }

  if (!getOpenAi()) {
    return { bundle: null, error: "IA indisponível (OPENAI_API_KEY)." };
  }

  const productsRepo = new CreatorProductsRepository(ctx.supabase, ctx.userId);
  const validationRepo = new CreatorValidationRepository(ctx.supabase, ctx.userId);

  const { data: product, error: productError } = await productsRepo.findById(productId);
  if (productError || !product) {
    return { bundle: null, error: productError ?? "Produto não encontrado." };
  }

  const { data: validation } = await validationRepo.findByProductId(productId);
  const locale = resolveCreatorLocale(product);

  const generated = await callCreatorAi<GeneratedCreatorOffer>(
    `${buildCreatorAiContext(locale)}
Crie ofertas de produtos digitais. ${buildLocaleAiRules(locale)}
Responda APENAS JSON:
{
  "headline": string,
  "subheadline": string,
  "bullet_points": string[],
  "garantia": string,
  "bonus": string,
  "cta": string
}`,
    JSON.stringify({ product, validation })
  );

  if (!generated?.headline) {
    return { bundle: null, error: "Não foi possível gerar a oferta." };
  }

  const offersRepo = new CreatorOffersRepository(ctx.supabase, ctx.userId);
  const { data: offer, error: offerError } = await offersRepo.upsertForProduct(
    productId,
    {
      headline: generated.headline,
      subheadline: generated.subheadline,
      bullet_points: generated.bullet_points,
      garantia: generated.garantia,
      bonus: generated.bonus,
      cta: generated.cta,
    }
  );

  if (offerError || !offer) {
    return { bundle: null, error: offerError ?? "Erro ao salvar oferta." };
  }

  const { error: updateError } = await productsRepo.update(productId, {
    status: "pagina_vendas",
  });

  if (updateError) {
    return { bundle: null, error: updateError };
  }

  return { bundle: await loadBundleById(productId), error: null };
}

export async function advanceCreatorStage(productId: string): Promise<{
  bundle: CreatorProductBundle | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { bundle: null, error: "Usuário não autenticado." };
  }

  const productsRepo = new CreatorProductsRepository(ctx.supabase, ctx.userId);
  const { data: product, error: productError } = await productsRepo.findById(productId);
  if (productError || !product) {
    return { bundle: null, error: productError ?? "Produto não encontrado." };
  }

  const next = getNextPipelineStage(product.status);
  if (!next) {
    return { bundle: null, error: "Produto já está no estágio final." };
  }

  const checklistRepo = new CreatorChecklistRepository(ctx.supabase, ctx.userId);
  const { data: checklist } = await checklistRepo.findByProductId(productId);
  const progress = computeChecklistProgress(checklist ?? [], product.status);
  if (progress.total > 0 && progress.percent < 100) {
    return {
      bundle: null,
      error: `Complete o checklist de ${product.status} (${progress.done}/${progress.total}) antes de avançar.`,
    };
  }

  const updates: Partial<CreatorProduct> = { status: next };

  if (next === "lancamento") {
    const locale = resolveCreatorLocale(product);
    await new CreatorLaunchesRepository(ctx.supabase, ctx.userId).upsertForProduct(
      productId,
      {
        status: "active",
        launched_at: new Date().toISOString(),
        ...pickLocaleFields(locale),
      }
    );
  }

  if (next === "escala") {
    await new CreatorLaunchesRepository(ctx.supabase, ctx.userId).upsertForProduct(
      productId,
      { status: "completed" }
    );
  }

  const { error: updateError } = await productsRepo.update(productId, updates);
  if (updateError) {
    return { bundle: null, error: updateError };
  }

  return { bundle: await loadBundleById(productId), error: null };
}

export async function toggleCreatorChecklistItem(
  itemId: string,
  status: "pendente" | "feito"
): Promise<{ bundle: CreatorProductBundle | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { bundle: null, error: "Usuário não autenticado." };
  }

  const checklistRepo = new CreatorChecklistRepository(ctx.supabase, ctx.userId);
  const { data: item } = await ctx.supabase
    .from("creator_checklist_items")
    .select("product_id")
    .eq("user_id", ctx.userId)
    .eq("id", itemId)
    .maybeSingle();

  if (!item) {
    return { bundle: null, error: "Item não encontrado." };
  }

  const { error } = await checklistRepo.toggleItem(itemId, status);
  if (error) {
    return { bundle: null, error };
  }

  return { bundle: await loadBundleById(item.product_id), error: null };
}

export async function generateCreatorPlan(productId: string): Promise<{
  plan: GeneratedCreatorPlan | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { plan: null, error: "Usuário não autenticado." };
  }

  if (!getOpenAi()) {
    return { plan: null, error: "IA indisponível (OPENAI_API_KEY)." };
  }

  const bundle = await loadBundleById(productId);
  if (!bundle) {
    return { plan: null, error: "Produto não encontrado." };
  }

  const locale = resolveCreatorLocale(bundle.product);

  const plan = await callCreatorAi<GeneratedCreatorPlan>(
    `${buildCreatorAiContext(locale)}
Crie um plano de 30 dias para lançar o produto digital no mercado ${locale.target_country}.
${buildLocaleAiRules(locale)}
Responda APENAS JSON:
{
  "titulo": string,
  "semanas": [
    { "semana": number, "foco": string, "tarefas": string[] }
  ]
}
4 semanas, 3-5 tarefas por semana.`,
    JSON.stringify({
      product: bundle.product,
      validation: bundle.validation,
      currentStage: bundle.product.status,
      pipeline: CREATOR_PIPELINE_STAGES.map((s) => s.label),
    })
  );

  if (!plan?.semanas?.length) {
    return { plan: null, error: "Não foi possível gerar o plano." };
  }

  return { plan, error: null };
}

export async function deleteCreatorProduct(productId: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { error: "Usuário não autenticado." };
  }

  const repo = new CreatorProductsRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.delete(productId);
  return { error };
}
