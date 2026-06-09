import OpenAI from "openai";
import {
  CreatorLaunchesRepository,
  CreatorOffersRepository,
  CreatorProductsRepository,
  CreatorValidationRepository,
} from "@/lib/supabase/repositories/creator.repository";
import { getLegacyContext } from "@/lib/supabase/services/legado.service";
import type {
  CreatorLaunch,
  CreatorOffer,
  CreatorProduct,
  CreatorValidation,
  TableInsert,
} from "@/types/database";
import {
  buildCreatorAuraContext,
  computeCreatorDashboard,
  type CreatorProductBundle,
  type CreatorProductIntake,
  type GeneratedCreatorOffer,
  type GeneratedCreatorProduct,
  type GeneratedCreatorValidation,
} from "@/utils/creator";
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

  const [{ bundles }, legacy] = await Promise.all([
    loadCreatorBundles(),
    getLegacyContext(),
  ]);

  const lines = [
    "## AURA CREATOR — Produtos digitais",
    buildCreatorAuraContext(bundles),
    legacy.context ?? "",
  ].filter(Boolean);

  return { context: lines.join("\n\n"), error: legacy.error };
}

export async function generateCreatorProduct(input: {
  intake: CreatorProductIntake;
  useAuraData: boolean;
}): Promise<{
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

  let auraContext = "";
  if (input.useAuraData) {
    const legacy = await getLegacyContext();
    auraContext = legacy.context ?? "";
  }

  const generated = await callCreatorAi<GeneratedCreatorProduct>(
    `Você é a Aura Creator — especialista em produtos digitais validados.
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
  "probabilidade_venda": number
}
Use português do Brasil. probabilidade_venda de 0 a 100.`,
    JSON.stringify({
      intake: input.intake,
      auraContext: auraContext || null,
    })
  );

  if (!generated?.nome) {
    return { bundle: null, error: "Não foi possível gerar o produto." };
  }

  const productsRepo = new CreatorProductsRepository(ctx.supabase, ctx.userId);
  const { data: product, error: createError } = await productsRepo.create({
    status: "draft",
    nicho: input.intake.nicho,
    conhecimento: input.intake.conhecimento,
    publico_alvo_input: input.intake.publico_alvo,
    objetivo_financeiro: input.intake.objetivo_financeiro,
    prazo: input.intake.prazo,
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
  } satisfies Omit<TableInsert<"creator_products">, "user_id">);

  if (createError || !product) {
    return { bundle: null, error: createError ?? "Erro ao salvar produto." };
  }

  return {
    bundle: {
      product: product as CreatorProduct,
      validation: null,
      offer: null,
      launch: null,
    },
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

  const generated = await callCreatorAi<GeneratedCreatorValidation>(
    `Você valida produtos digitais. Responda APENAS JSON:
{
  "demanda": number,
  "concorrencia": number,
  "facilidade_criacao": number,
  "facilidade_venda": number,
  "escalabilidade": number,
  "nota_final": number
}
Cada score de 0 a 100. nota_final = média ponderada (demanda e escalabilidade peso 1.2).`,
    JSON.stringify({ product })
  );

  if (generated == null || typeof generated.nota_final !== "number") {
    return { bundle: null, error: "Não foi possível validar o produto." };
  }

  const validationRepo = new CreatorValidationRepository(ctx.supabase, ctx.userId);
  const { data: validation, error: validationError } =
    await validationRepo.upsertForProduct(productId, {
      demanda: generated.demanda,
      concorrencia: generated.concorrencia,
      facilidade_criacao: generated.facilidade_criacao,
      facilidade_venda: generated.facilidade_venda,
      escalabilidade: generated.escalabilidade,
      nota_final: generated.nota_final,
    });

  if (validationError || !validation) {
    return { bundle: null, error: validationError ?? "Erro ao salvar validação." };
  }

  const potencial =
    ((product.faixa_preco_min ?? 0) + (product.faixa_preco_max ?? 0)) / 2;

  await new CreatorLaunchesRepository(ctx.supabase, ctx.userId).upsertForProduct(
    productId,
    {
      status: "planned",
      potencial_estimado: potencial > 0 ? potencial * (generated.nota_final / 100) * 10 : null,
    }
  );

  const { data: updatedProduct, error: updateError } = await productsRepo.update(
    productId,
    { status: "validated" }
  );

  if (updateError) {
    return { bundle: null, error: updateError };
  }

  const { data: launchRow } = await ctx.supabase
    .from("creator_launches")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("product_id", productId)
    .maybeSingle();

  return {
    bundle: {
      product: (updatedProduct ?? product) as CreatorProduct,
      validation: validation as CreatorValidation,
      offer: null,
      launch: (launchRow as CreatorLaunch | null) ?? null,
    },
    error: null,
  };
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

  const generated = await callCreatorAi<GeneratedCreatorOffer>(
    `Você cria ofertas de produtos digitais. Responda APENAS JSON:
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

  const { data: updatedProduct, error: updateError } = await productsRepo.update(
    productId,
    { status: "offered" }
  );

  if (updateError) {
    return { bundle: null, error: updateError };
  }

  const { data: launchRow } = await ctx.supabase
    .from("creator_launches")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("product_id", productId)
    .maybeSingle();

  return {
    bundle: {
      product: (updatedProduct ?? product) as CreatorProduct,
      validation: validation as CreatorValidation | null,
      offer: offer as CreatorOffer,
      launch: (launchRow as CreatorLaunch | null) ?? null,
    },
    error: null,
  };
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
