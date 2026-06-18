import OpenAI from "openai";
import { LandingPagesRepository } from "@/lib/supabase/repositories/landing-factory.repository";
import { loadCopylabRecords } from "@/lib/supabase/services/copylab.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import type { Json, LandingPage, TableInsert } from "@/types/database";
import type { CreatorProductBundle } from "@/utils/creator";
import { COPYLAB_AI_CONTEXT } from "@/utils/copylab";
import {
  buildLandingPageHtml,
  buildLandingPreviewUrl,
  buildLandingPublishedUrl,
  buildLandingSlugBase,
  computeLandingFactoryDashboard,
  landingPageToCreatorLanding,
  type GeneratedLandingPage,
  type LandingFactoryDashboardMetrics,
  type LandingFactoryIntake,
} from "@/utils/landing-factory";
import { applyWinnerPatternToSystemPrompt } from "@/utils/winner-pattern";
import type { WinnerContext } from "@/utils/winner-pattern";
import { getWinnerContext } from "./winner-pattern.service";
import { getOptionalDataContext } from "./context";

const LANDING_FACTORY_SYSTEM = `${COPYLAB_AI_CONTEXT}

Você é a Aura Landing Factory — cria páginas de vendas de alta conversão.
Regras éticas obrigatórias:
- Nunca prometa resultados garantidos, dinheiro fácil ou cura
- Evite claims proibidos (renda garantida, sem esforço, aprovação médica sem base)
- Use prova social realista, sem depoimentos falsos
- Copy persuasiva mas honesta

Responda APENAS JSON:
{
  "title": string,
  "headline": string,
  "subheadline": string,
  "hero_copy": string,
  "benefits": [{ "title": string, "description": string }],
  "proof": {
    "testimonials": [{ "nome": string, "texto": string, "resultado": string }],
    "stats": [{ "label": string, "value": string }]
  },
  "offer": {
    "price_label": string,
    "original_price": string,
    "bonuses": string[],
    "guarantee": string,
    "urgency": string,
    "stack": string[]
  },
  "faq": [{ "pergunta": string, "resposta": string }],
  "cta_text": string
}`;

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

async function callLandingFactoryAi<T>(system: string, user: string): Promise<T | null> {
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

async function resolveUniqueSlug(
  repo: LandingPagesRepository,
  baseTitle: string
): Promise<string> {
  const base = buildLandingSlugBase(baseTitle);
  const suffix = Math.random().toString(36).slice(2, 7);
  let candidate = `${base}-${suffix}`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { exists } = await repo.slugExists(candidate);
    if (!exists) return candidate;
    candidate = `${base}-${Math.random().toString(36).slice(2, 7)}`;
  }

  return `${base}-${Date.now().toString(36)}`;
}

async function resolveIntakeContext(input: LandingFactoryIntake): Promise<{
  bundle: CreatorProductBundle | null;
  copyContext: string;
}> {
  const { bundles } = await loadCreatorBundles();
  const bundle =
    bundles.find((b) => b.product.id === input.product_id) ??
    bundles.find((b) => b.product.nome === input.titulo) ??
    null;

  const { records: copyRecords } = await loadCopylabRecords();
  let copyContext = "Nenhuma copy no CopyLab.";

  if (input.copylab_id) {
    const copy = copyRecords.find((r) => r.id === input.copylab_id);
    if (copy) {
      copyContext = [
        `Headline: ${copy.headline ?? "—"}`,
        `Subheadline: ${copy.subheadline ?? "—"}`,
        `Big idea: ${copy.big_idea ?? "—"}`,
        `Bullets: ${Array.isArray(copy.bullets) ? copy.bullets.join("; ") : "—"}`,
        `CTA: ${copy.cta ?? "—"}`,
        `Página vendas: ${copy.pagina_vendas?.slice(0, 300) ?? "—"}`,
      ].join("\n");
    }
  } else if (bundle) {
    const copy = copyRecords.find((r) => r.product_id === bundle.product.id);
    if (copy) {
      copyContext = `Copy do produto: ${copy.headline ?? "—"} · ${copy.cta ?? "—"}`;
    }
  }

  return { bundle, copyContext };
}

function buildUserPrompt(
  input: LandingFactoryIntake,
  bundle: CreatorProductBundle | null,
  copyContext: string,
  winnerContext: WinnerContext
): string {
  const product = bundle?.product;
  return JSON.stringify({
    intake: input,
    product: product
      ? {
          nome: product.nome,
          promessa: product.promessa,
          avatar: product.avatar,
          problema: product.problema,
          solucao: product.solucao,
          diferenciais: product.diferenciais,
          faixa_preco_min: product.faixa_preco_min,
          faixa_preco_max: product.faixa_preco_max,
        }
      : null,
    copylabContext: copyContext,
    headlineHint: input.headline ?? null,
    winnerContext,
    instruction:
      "Gere landing de alta conversão para produto digital. Status inicial será rascunho — não inclua URLs externas de checkout.",
  });
}

export async function loadLandingPages(): Promise<{
  pages: LandingPage[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { pages: [], error: "Usuário não autenticado." };

  const repo = new LandingPagesRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findAllOrdered();
  return { pages: data ?? [], error };
}

export async function getLandingFactoryDashboard(params?: {
  operationId?: string | null;
}): Promise<{
  dashboard: LandingFactoryDashboardMetrics;
  pages: LandingPage[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      dashboard: { total: 0, draft: 0, published: 0, operationLinked: 0 },
      pages: [],
      error: "Usuário não autenticado.",
    };
  }

  const repo = new LandingPagesRepository(ctx.supabase, ctx.userId);
  const operationId = params?.operationId?.trim();

  if (operationId) {
    const { data, error } = await repo.findByOperationId(operationId);
    const pages = data ?? [];
    return {
      dashboard: computeLandingFactoryDashboard(pages),
      pages,
      error: error ?? null,
    };
  }

  const { data, error } = await repo.findAllOrdered();
  const pages = data ?? [];
  return {
    dashboard: computeLandingFactoryDashboard(pages),
    pages,
    error: error ?? null,
  };
}

export async function getLandingPageBySlug(
  slug: string,
  options?: { publicOnly?: boolean }
): Promise<{ page: LandingPage | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  const trimmed = slug.trim();
  if (!trimmed) return { page: null, error: "Slug inválido." };

  if (options?.publicOnly || !ctx) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("landing_pages")
      .select("*")
      .eq("slug", trimmed)
      .eq("status", "published")
      .maybeSingle();

    if (error) return { page: null, error: error.message };
    return { page: (data as LandingPage | null) ?? null, error: null };
  }

  const repo = new LandingPagesRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findBySlug(trimmed);
  if (error) return { page: null, error };
  if (!data) return { page: null, error: "Landing não encontrada." };
  return { page: data, error: null };
}

export async function generateLandingPage(input: LandingFactoryIntake): Promise<{
  page: LandingPage | null;
  message: string;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { page: null, message: "", error: "Usuário não autenticado." };
  }
  if (!getOpenAi()) {
    return { page: null, message: "", error: "IA indisponível (OPENAI_API_KEY)." };
  }

  const operationId = input.operation_id?.trim() || null;
  const productId = input.product_id?.trim() || null;

  const { bundle, copyContext } = await resolveIntakeContext(input);
  const titleBase =
    input.titulo?.trim() ||
    bundle?.product.nome?.trim() ||
    input.promessa?.trim() ||
    "landing";

  const { context: winnerContext, promptBlock } = await getWinnerContext({
    module: "landing-factory",
    niche: bundle?.product.nicho ?? bundle?.product.publico_alvo,
    country: bundle?.product.target_country,
  });

  const repo = new LandingPagesRepository(ctx.supabase, ctx.userId);
  const slug = await resolveUniqueSlug(repo, titleBase);

  const generated = await callLandingFactoryAi<GeneratedLandingPage>(
    applyWinnerPatternToSystemPrompt(LANDING_FACTORY_SYSTEM, promptBlock, "landing-factory"),
    buildUserPrompt(input, bundle, copyContext, winnerContext)
  );

  if (!generated?.headline) {
    return {
      page: null,
      message: "",
      error: "Não foi possível gerar a landing page.",
    };
  }

  const previewUrl = buildLandingPreviewUrl(slug);
  const html = buildLandingPageHtml({
    title: generated.title,
    headline: generated.headline,
    subheadline: generated.subheadline,
    hero_copy: generated.hero_copy,
    benefits_json: generated.benefits as unknown as Json,
    proof_json: generated.proof as unknown as Json,
    offer_json: generated.offer as unknown as Json,
    faq_json: generated.faq as unknown as Json,
    cta_text: generated.cta_text,
  });

  const { data: page, error: createError } = await repo.create({
    operation_id: operationId,
    product_id: productId ?? bundle?.product.id ?? null,
    title: generated.title ?? titleBase,
    slug,
    headline: generated.headline,
    subheadline: generated.subheadline,
    hero_copy: generated.hero_copy,
    benefits_json: generated.benefits as unknown as Json,
    proof_json: generated.proof as unknown as Json,
    offer_json: generated.offer as unknown as Json,
    faq_json: generated.faq as unknown as Json,
    cta_text: generated.cta_text,
    html,
    status: "draft",
    preview_url: previewUrl,
    published_url: null,
    metadata: {
      safe_mode: true,
      auto_publish: false,
      copylab_id: input.copylab_id ?? null,
      generated,
    } as Json,
  } satisfies Omit<TableInsert<"landing_pages">, "user_id">);

  if (createError || !page) {
    return {
      page: null,
      message: "",
      error: createError ?? "Erro ao salvar landing page.",
    };
  }

  void import("./growth-brain.service")
    .then(({ registerLandingResult }) =>
      registerLandingResult({
        landingId: page.id,
        productId: page.product_id,
        operationId: page.operation_id,
        metricType: "estimated",
        lesson: `Landing gerada: ${page.title ?? page.headline ?? slug}`,
        recommendation: "Publique e vincule à operação para medir conversão.",
        metadata: {
          source: "landing_factory",
          type: "landing",
          landing_label: page.title ?? page.headline,
          product_label: bundle?.product.nome ?? titleBase,
        },
      })
    )
    .catch(() => undefined);

  const message = `Landing "${page.title ?? slug}" gerada em rascunho. Preview interno disponível.`;

  void import("./excellence-integration.service")
    .then(({ scheduleExcellenceReview }) => {
      scheduleExcellenceReview("landing", page.id, page.title ?? page.headline ?? undefined, "landing-factory");
    })
    .catch(() => undefined);

  return { page, message, error: null };
}

export async function publishLandingPage(
  landingId: string
): Promise<{ page: LandingPage | null; message: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { page: null, message: "", error: "Usuário não autenticado." };

  const repo = new LandingPagesRepository(ctx.supabase, ctx.userId);
  const { data: existing, error: findError } = await repo.findById(landingId);
  if (findError || !existing) {
    return { page: null, message: "", error: findError ?? "Landing não encontrada." };
  }

  if (existing.status === "published") {
    return {
      page: existing,
      message: "Landing já está publicada.",
      error: null,
    };
  }

  const { requireExcellenceDelivery } = await import("./excellence-integration.service");
  const specialistGate = await requireExcellenceDelivery("landing", landingId, {
    module: "landing-factory",
  });
  if (!specialistGate.allowed) {
    return {
      page: null,
      message: "",
      error: specialistGate.error ?? "Landing bloqueada pelo Specialist Engine.",
    };
  }

  const publishedUrl = buildLandingPublishedUrl(existing.slug);
  const { data: page, error: updateError } = await repo.update(landingId, {
    status: "published",
    published_url: publishedUrl,
    metadata: {
      ...(typeof existing.metadata === "object" && existing.metadata && !Array.isArray(existing.metadata)
        ? existing.metadata
        : {}),
      published_at: new Date().toISOString(),
    } as Json,
  });

  if (updateError || !page) {
    return { page: null, message: "", error: updateError ?? "Erro ao publicar landing." };
  }

  return {
    page,
    message: `Landing publicada em ${publishedUrl}`,
    error: null,
  };
}

export async function loadLandingPagesForOrchestrator(): Promise<{
  records: ReturnType<typeof landingPageToCreatorLanding>[];
  error: string | null;
}> {
  const { pages, error } = await loadLandingPages();
  return {
    records: pages.map(landingPageToCreatorLanding),
    error,
  };
}

export async function getLandingFactoryContext(): Promise<{ context: string; error: string | null }> {
  const { pages, error } = await loadLandingPages();
  if (error) return { context: "", error };

  if (pages.length === 0) {
    return { context: "Landing Factory: nenhuma landing gerada ainda.", error: null };
  }

  const summary = pages
    .slice(0, 5)
    .map(
      (p) =>
        `• ${p.title ?? p.slug} (${p.status})${p.operation_id ? " [op]" : ""}${p.published_url ? ` → ${p.published_url}` : ""}`
    )
    .join("\n");

  return {
    context: `## LANDING FACTORY\n${summary}`,
    error: null,
  };
}
