import OpenAI from "openai";
import { CreatorAssetsRepository } from "@/lib/supabase/repositories/creator-assets.repository";
import { loadCopylabRecords } from "@/lib/supabase/services/copylab.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import { getLegacyContext } from "@/lib/supabase/services/legado.service";
import { loadLaunchPlans } from "@/lib/supabase/services/launch.service";
import { loadResearchRecords } from "@/lib/supabase/services/research.service";
import type { CreatorAsset, TableInsert, TableUpdate } from "@/types/database";
import {
  buildStudioAuraContext,
  computeStudioDashboard,
  type GeneratedStudioCarrossel,
  type GeneratedStudioCriativo,
  type GeneratedStudioFull,
  type GeneratedStudioRoteiro,
  type GeneratedStudioSocial,
  type GeneratedStudioThumbnail,
  type GeneratedStudioVsl,
  type StudioDashboardMetrics,
  type StudioGenerateKind,
  type StudioIntake,
} from "@/utils/creative-studio";
import {
  buildLocaleAiRules,
  buildStudioAiContext,
  resolveCreatorLocale,
  type CreatorLocale,
} from "@/utils/creator-locale";
import { CreatorProductsRepository } from "@/lib/supabase/repositories/creator.repository";
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

async function callStudioAi<T>(system: string, user: string): Promise<T | null> {
  const openai = getOpenAi();
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.75,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  return parseJsonBlock<T>(content);
}

async function loadModuleContext(): Promise<{
  legacyContext: string | null;
  creatorSummary: string;
  researchSummary: string;
  copylabSummary: string;
  launchSummary: string;
}> {
  const [legacy, { bundles }, { records: researchRecords }, { records: copyRecords }, launch] =
    await Promise.all([
      getLegacyContext(),
      loadCreatorBundles(),
      loadResearchRecords(),
      loadCopylabRecords(),
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
          .map(
            (c) =>
              `• ${c.nome ?? c.headline ?? "—"} — headline: ${c.headline?.slice(0, 50) ?? "—"}`
          )
          .join("\n")
      : "Nenhuma copy no CopyLab.";

  const launchSummary =
    launch.plans.length > 0
      ? launch.plans
          .slice(0, 3)
          .map((p) => `• ${p.titulo ?? "—"} · estágio ${p.estagio_atual ?? "—"}`)
          .join("\n")
      : "Nenhum plano no Launch Center.";

  return {
    legacyContext: legacy.context ?? null,
    creatorSummary,
    researchSummary,
    copylabSummary,
    launchSummary,
  };
}

const GENERATION_PROMPTS: Record<
  StudioGenerateKind,
  (locale: CreatorLocale) => { system: string; fields: string }
> = {
  criativo: (locale) => ({
    system: `${buildStudioAiContext(locale)}
Responda APENAS JSON:
{
  "criativo_facebook": string,
  "criativo_instagram": string,
  "mockup_produto": string
}
Regras:
- criativo_facebook: briefing completo (headline, corpo, visual, CTA, formato 1:1 ou 4:5)
- criativo_instagram: briefing para feed/stories com hook visual
- mockup_produto: descrição detalhada do mockup 3D ou flat design
- Conteúdo em ${locale.target_language}, persuasivo para ${locale.target_country}
${buildLocaleAiRules(locale)}`,
    fields: "criativo",
  }),
  roteiro: (locale) => ({
    system: `${buildStudioAiContext(locale)}
Responda APENAS JSON:
{
  "roteiro_reels": string,
  "roteiro_shorts": string,
  "roteiro_tiktok": string
}
Regras:
- Cada roteiro com gancho (3s), desenvolvimento, CTA final
- roteiro_reels: 30-60s, formato vertical
- roteiro_shorts: 15-45s, YouTube Shorts
- roteiro_tiktok: 15-30s, linguagem nativa TikTok
- Conteúdo em ${locale.target_language} para ${locale.target_country}
${buildLocaleAiRules(locale)}`,
    fields: "roteiro",
  }),
  carrossel: (locale) => ({
    system: `${buildStudioAiContext(locale)}
Responda APENAS JSON:
{
  "carrossel_instagram": string[]
}
Regras:
- 5 a 8 slides com texto de cada slide (headline + corpo)
- Slide 1: hook magnético
- Último slide: CTA forte
- Conteúdo em ${locale.target_language}
${buildLocaleAiRules(locale)}`,
    fields: "carrossel",
  }),
  thumbnail: (locale) => ({
    system: `${buildStudioAiContext(locale)}
Responda APENAS JSON:
{
  "capa_ebook": string,
  "thumbnail_youtube": string
}
Regras:
- capa_ebook: briefing visual completo (título, cores, elementos, tipografia)
- thumbnail_youtube: briefing 1280x720 com texto overlay, expressão, contraste
- Conteúdo em ${locale.target_language}
${buildLocaleAiRules(locale)}`,
    fields: "thumbnail",
  }),
  vsl: (locale) => ({
    system: `${buildStudioAiContext(locale)}
Responda APENAS JSON:
{
  "vsl": string
}
Regras:
- Roteiro completo: gancho, problema, agitação, solução, prova, oferta, garantia, CTA
- Marcadores de tempo e indicações visuais
- Conteúdo em ${locale.target_language}, persuasivo
${buildLocaleAiRules(locale)}`,
    fields: "vsl",
  }),
  social: (locale) => ({
    system: `${buildStudioAiContext(locale)}
Responda APENAS JSON:
{
  "stories": string[],
  "legendas": string,
  "cta": string
}
Regras:
- stories: 3 a 5 frames com texto e indicação visual
- legendas: texto para post com hashtags locais
- cta: call-to-action direto e memorável
- Conteúdo em ${locale.target_language}
${buildLocaleAiRules(locale)}`,
    fields: "social",
  }),
  full: (locale) => ({
    system: `${buildStudioAiContext(locale)}
Responda APENAS JSON:
{
  "criativo_facebook": string,
  "criativo_instagram": string,
  "capa_ebook": string,
  "thumbnail_youtube": string,
  "mockup_produto": string,
  "roteiro_reels": string,
  "roteiro_shorts": string,
  "roteiro_tiktok": string,
  "vsl": string,
  "carrossel_instagram": string[],
  "stories": string[],
  "legendas": string,
  "cta": string
}
Regras: briefings detalhados e prontos para produção em ${locale.target_language}.
${buildLocaleAiRules(locale)}`,
    fields: "full",
  }),
};

export async function loadStudioAssets(): Promise<{
  records: CreatorAsset[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { records: [], error: "Usuário não autenticado." };

  const repo = new CreatorAssetsRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findAllOrdered();
  if (error) return { records: [], error };
  return { records: data ?? [], error: null };
}

export async function getStudioDashboard(): Promise<{
  dashboard: StudioDashboardMetrics | null;
  records: CreatorAsset[];
  error: string | null;
}> {
  const { records, error } = await loadStudioAssets();
  if (error) return { dashboard: null, records: [], error };
  return {
    dashboard: computeStudioDashboard(records),
    records,
    error: null,
  };
}

export async function getStudioContext(): Promise<{ context: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { context: "", error: "Usuário não autenticado." };

  const [{ records }, moduleCtx] = await Promise.all([loadStudioAssets(), loadModuleContext()]);

  const lines = [
    "## AURA CREATIVE STUDIO",
    buildStudioAuraContext(records),
    `## CREATOR\n${moduleCtx.creatorSummary}`,
    `## RESEARCH\n${moduleCtx.researchSummary}`,
    `## COPYLAB\n${moduleCtx.copylabSummary}`,
    `## LAUNCH CENTER\n${moduleCtx.launchSummary}`,
    moduleCtx.legacyContext ? `## LEGADO\n${moduleCtx.legacyContext}` : "",
  ].filter(Boolean);

  return { context: lines.join("\n\n"), error: null };
}

export async function generateStudioAssets(
  input: StudioIntake,
  kind: StudioGenerateKind
): Promise<{ record: CreatorAsset | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { record: null, error: "Usuário não autenticado." };
  if (!getOpenAi()) return { record: null, error: "IA indisponível (OPENAI_API_KEY)." };

  if (!input.nome.trim() && !input.problema.trim()) {
    return { record: null, error: "Informe o nome ou o problema do produto." };
  }

  const moduleCtx = await loadModuleContext();
  const repo = new CreatorAssetsRepository(ctx.supabase, ctx.userId);

  let existing: CreatorAsset | null = null;
  if (input.asset_id) {
    const { data } = await repo.findById(input.asset_id);
    existing = data;
  } else if (input.product_id) {
    const { data } = await repo.findByProductId(input.product_id);
    existing = data;
  }

  let locale = resolveCreatorLocale(input);
  if (input.product_id) {
    const productsRepo = new CreatorProductsRepository(ctx.supabase, ctx.userId);
    const { data: product } = await productsRepo.findById(input.product_id);
    if (product) locale = resolveCreatorLocale(product);
  }

  const prompt = GENERATION_PROMPTS[kind](locale);
  const generated = await callStudioAi<
    | GeneratedStudioCriativo
    | GeneratedStudioRoteiro
    | GeneratedStudioCarrossel
    | GeneratedStudioThumbnail
    | GeneratedStudioVsl
    | GeneratedStudioSocial
    | GeneratedStudioFull
  >(
    prompt.system,
    JSON.stringify({
      intake: input,
      existingAssets: existing
        ? {
            criativo_facebook: existing.criativo_facebook,
            criativo_instagram: existing.criativo_instagram,
            roteiro_reels: existing.roteiro_reels,
          }
        : null,
      legacyContext: moduleCtx.legacyContext,
      creatorContext: moduleCtx.creatorSummary,
      researchContext: moduleCtx.researchSummary,
      copylabContext: moduleCtx.copylabSummary,
      launchContext: moduleCtx.launchSummary,
    })
  );

  if (!generated) {
    return { record: null, error: "Não foi possível gerar os ativos." };
  }

  const baseFields = {
    nome: input.nome || null,
    avatar: input.avatar || null,
    problema: input.problema || null,
    solucao: input.solucao || null,
    promessa: input.promessa || null,
    diferencial: input.diferencial || null,
    preco: input.preco,
    product_id: input.product_id ?? null,
    copylab_id: input.copylab_id ?? null,
  };

  const updatePayload: TableUpdate<"creator_assets"> = {};

  if ("criativo_facebook" in generated && generated.criativo_facebook) {
    updatePayload.criativo_facebook = generated.criativo_facebook;
  }
  if ("criativo_instagram" in generated && generated.criativo_instagram) {
    updatePayload.criativo_instagram = generated.criativo_instagram;
  }
  if ("mockup_produto" in generated && generated.mockup_produto) {
    updatePayload.mockup_produto = generated.mockup_produto;
  }
  if ("roteiro_reels" in generated && generated.roteiro_reels) {
    updatePayload.roteiro_reels = generated.roteiro_reels;
  }
  if ("roteiro_shorts" in generated && generated.roteiro_shorts) {
    updatePayload.roteiro_shorts = generated.roteiro_shorts;
  }
  if ("roteiro_tiktok" in generated && generated.roteiro_tiktok) {
    updatePayload.roteiro_tiktok = generated.roteiro_tiktok;
  }
  if ("capa_ebook" in generated && generated.capa_ebook) {
    updatePayload.capa_ebook = generated.capa_ebook;
  }
  if ("thumbnail_youtube" in generated && generated.thumbnail_youtube) {
    updatePayload.thumbnail_youtube = generated.thumbnail_youtube;
  }
  if ("vsl" in generated && generated.vsl) {
    updatePayload.vsl = generated.vsl;
  }
  if ("carrossel_instagram" in generated && generated.carrossel_instagram) {
    updatePayload.carrossel_instagram = generated.carrossel_instagram;
  }
  if ("stories" in generated && generated.stories) {
    updatePayload.stories = generated.stories;
  }
  if ("legendas" in generated && generated.legendas) {
    updatePayload.legendas = generated.legendas;
  }
  if ("cta" in generated && generated.cta) {
    updatePayload.cta = generated.cta;
  }

  if (Object.keys(updatePayload).length === 0) {
    return { record: null, error: "Resposta da IA sem conteúdo válido." };
  }

  if (existing) {
    const { data: updated, error: updateError } = await repo.update(existing.id, updatePayload);
    if (updateError || !updated) {
      return { record: null, error: updateError ?? "Erro ao atualizar ativos." };
    }
    return { record: updated as CreatorAsset, error: null };
  }

  const { data: record, error: createError } = await repo.create({
    ...baseFields,
    ...updatePayload,
  } satisfies Omit<TableInsert<"creator_assets">, "user_id">);

  if (createError || !record) {
    return { record: null, error: createError ?? "Erro ao salvar ativos." };
  }

  return { record: record as CreatorAsset, error: null };
}

export async function deleteStudioAsset(id: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new CreatorAssetsRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.delete(id);
  return { error };
}
