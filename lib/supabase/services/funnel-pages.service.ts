import OpenAI from "openai";
import { recordSystemLog } from "@/lib/logs/record";
import { FunnelPagesRepository } from "@/lib/supabase/repositories/funnel-pages.repository";
import {
  FunnelStepsRepository,
  FunnelsRepository,
} from "@/lib/supabase/repositories/funnel-engine.repository";
import { LandingPagesRepository } from "@/lib/supabase/repositories/landing-factory.repository";
import { OffersRepository } from "@/lib/supabase/repositories/offer-engine.repository";
import { loadCopylabRecords } from "@/lib/supabase/services/copylab.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import { generateLandingPage } from "@/lib/supabase/services/landing-factory.service";
import type {
  Funnel,
  FunnelPage,
  FunnelPageType,
  Json,
  LandingPage,
  Offer,
  TableInsert,
} from "@/types/database";
import { COPYLAB_AI_CONTEXT } from "@/utils/copylab";
import { buildLandingSlugBase } from "@/utils/landing-factory";
import { readOfferTakeRate } from "@/utils/offer-engine";
import {
  buildFunnelPagesAuraContext,
  computeFunnelPagesDashboard,
  mergeFunnelPageMetadata,
  pageTypeLabel,
  resolveOfferForPageType,
  type FunnelPagesBundle,
  type FunnelPagesDashboard,
  type FunnelPagesIntake,
} from "@/utils/funnel-pages";
import { getOptionalDataContext } from "./context";
import { getWinnerContext } from "./winner-pattern.service";
import {
  augmentGeneratorSystemPrompt,
  buildTransversalGenerationContext,
} from "./expert-brain.service";

const FUNNEL_PAGES_SYSTEM = `${COPYLAB_AI_CONTEXT}

Você é a Aura Funnel Pages Pro — cria páginas de funil de alta conversão.
Regras:
- Copy honesta, sem promessas proibidas
- Cada página deve ter objetivo claro de conversão
- conversion_goal entre 0 e 1 (ex.: 0.035 = 3,5%)
- Slug curto, em kebab-case, sem acentos

Responda APENAS JSON conforme solicitado.`;

type PageGenerationContext = {
  funnel: Funnel;
  productId: string;
  operationId: string | null;
  copylabId: string | null;
  productName: string;
  promessa: string;
  problema: string;
  solucao: string;
  avatar: string;
  niche: string;
  copyContext: string;
  creativeContext: string;
  offers: Offer[];
};

type GeneratedPageSpec = {
  title: string;
  slug: string;
  conversion_goal: number;
  headline?: string;
  promessa?: string;
  cta?: string;
};

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

async function callFunnelPagesAi<T>(
  user: string,
  systemPrompt?: string
): Promise<T | null> {
  const openai = getOpenAi();
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt ?? FUNNEL_PAGES_SYSTEM },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  return parseJsonBlock<T>(content);
}

async function resolveUniqueSlug(
  repo: FunnelPagesRepository,
  landingRepo: LandingPagesRepository,
  baseTitle: string
): Promise<string> {
  const base = buildLandingSlugBase(baseTitle);
  const suffix = Math.random().toString(36).slice(2, 6);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = attempt === 0 ? `${base}-${suffix}` : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const [{ exists: funnelExists }, { exists: landingExists }] = await Promise.all([
      repo.slugExists(candidate),
      landingRepo.slugExists(candidate),
    ]);
    if (!funnelExists && !landingExists) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}

async function loadCreativeDirectorContext(operationId: string | null): Promise<string> {
  if (!operationId) return "Creative Director: sem operação vinculada.";
  try {
    const { getCreativeDirectorContext } = await import("./creative-director.service");
    const { context } = await getCreativeDirectorContext();
    return context ? `Creative Director:\n${context.slice(0, 600)}` : "Creative Director: pacote ainda não gerado.";
  } catch {
    return "Creative Director: indisponível.";
  }
}

async function buildPageGenerationContext(
  funnel: Funnel,
  input: FunnelPagesIntake,
  offers: Offer[]
): Promise<{ context: PageGenerationContext | null; error: string | null }> {
  const productId = input.product_id?.trim() || funnel.product_id?.trim();
  if (!productId) {
    return { context: null, error: "Funil sem product_id." };
  }

  const { bundles } = await loadCreatorBundles();
  const productBundle = bundles.find((b) => b.product.id === productId) ?? null;
  if (!productBundle) {
    return { context: null, error: "Produto não encontrado." };
  }

  const copylabId = input.copylab_id?.trim() || null;
  const { records: copyRecords } = await loadCopylabRecords();
  let copyContext = "Sem copy no CopyLab.";
  const copy =
    (copylabId ? copyRecords.find((r) => r.id === copylabId) : null) ??
    copyRecords.find((r) => r.product_id === productId) ??
    null;

  if (copy) {
    copyContext = [
      `Headline: ${copy.headline ?? "—"}`,
      `Subheadline: ${copy.subheadline ?? "—"}`,
      `Big idea: ${copy.big_idea ?? "—"}`,
      `Bullets: ${Array.isArray(copy.bullets) ? copy.bullets.join("; ") : "—"}`,
      `CTA: ${copy.cta ?? "—"}`,
    ].join("\n");
  }

  const operationId = input.operation_id?.trim() || funnel.operation_id?.trim() || null;
  const creativeContext = await loadCreativeDirectorContext(operationId);

  return {
    context: {
      funnel,
      productId,
      operationId,
      copylabId: copylabId ?? copy?.id ?? null,
      productName: productBundle.product.nome?.trim() || funnel.funnel_name,
      promessa: productBundle.product.promessa?.trim() || copy?.headline?.trim() || funnel.funnel_name,
      problema: productBundle.product.problema?.trim() || "—",
      solucao: productBundle.product.solucao?.trim() || "—",
      avatar: productBundle.product.avatar?.trim() || productBundle.product.publico_alvo?.trim() || "—",
      niche: funnel.niche?.trim() || productBundle.product.nicho?.trim() || "geral",
      copyContext,
      creativeContext,
      offers,
    },
    error: null,
  };
}

async function generatePageSpec(
  context: PageGenerationContext,
  pageType: FunnelPageType,
  offer: Offer | null,
  extra?: Record<string, unknown>
): Promise<GeneratedPageSpec | null> {
  const fallbackSlug = buildLandingSlugBase(`${context.productName}-${pageType}`);
  const fallback: GeneratedPageSpec = {
    title: `${pageTypeLabel(pageType)} — ${context.productName}`,
    slug: fallbackSlug,
    conversion_goal:
      pageType === "front_end"
        ? Number(context.funnel.expected_conversion ?? 0.035)
        : offer
          ? readOfferTakeRate(offer)
          : pageType === "thank_you"
            ? 1
            : 0.15,
    headline: offer?.title ?? context.promessa,
    promessa: offer?.description ?? context.promessa,
    cta: "Quero garantir minha vaga",
  };

  const { context: winnerContext, promptBlock } = await getWinnerContext({
    module: "funnel-pages",
    niche: context.niche,
  });
  const transversal = await buildTransversalGenerationContext({
    task: "landing_page",
    module: "funnel-pages",
    niche: context.niche,
    winnerPromptBlock: promptBlock,
  });
  const system = augmentGeneratorSystemPrompt(
    FUNNEL_PAGES_SYSTEM,
    "funnel-pages",
    transversal,
    promptBlock
  );

  const generated = await callFunnelPagesAi<GeneratedPageSpec>(
    JSON.stringify({
      task: `generate_${pageType}_page`,
      page_type: pageType,
      funnel: context.funnel.funnel_name,
      product: {
        name: context.productName,
        promessa: context.promessa,
        problema: context.problema,
        solucao: context.solucao,
        avatar: context.avatar,
        niche: context.niche,
      },
      offer: offer
        ? {
            title: offer.title,
            description: offer.description,
            price: offer.price,
            type: offer.offer_type,
          }
        : null,
      copy: context.copyContext,
      creative: context.creativeContext,
      winnerContext,
      expertContext: transversal.expertContext,
      decisionContext: transversal.decisionContext,
      excellenceCriteria: transversal.excellenceCriteria,
      extra,
      response: {
        title: "string",
        slug: "string kebab-case",
        conversion_goal: "number 0-1",
        headline: "string",
        promessa: "string",
        cta: "string",
      },
    }),
    system
  );

  if (!generated?.title) return fallback;
  return {
    title: generated.title,
    slug: generated.slug?.trim() || fallback.slug,
    conversion_goal:
      generated.conversion_goal != null && Number.isFinite(generated.conversion_goal)
        ? generated.conversion_goal > 1
          ? generated.conversion_goal / 100
          : generated.conversion_goal
        : fallback.conversion_goal,
    headline: generated.headline ?? fallback.headline,
    promessa: generated.promessa ?? fallback.promessa,
    cta: generated.cta ?? fallback.cta,
  };
}

async function persistFunnelPage(params: {
  repo: FunnelPagesRepository;
  landingRepo: LandingPagesRepository;
  context: PageGenerationContext;
  pageType: FunnelPageType;
  offer: Offer | null;
  spec: GeneratedPageSpec;
  landing: LandingPage | null;
  extraMetadata?: Record<string, unknown>;
}): Promise<{ page: FunnelPage | null; error: string | null }> {
  const slug = await resolveUniqueSlug(params.repo, params.landingRepo, params.spec.slug);

  const { data: page, error } = await params.repo.create({
    funnel_id: params.context.funnel.id,
    offer_id: params.offer?.id ?? null,
    page_type: params.pageType,
    landing_page_id: params.landing?.id ?? null,
    slug,
    title: params.spec.title,
    status: params.landing ? "ready" : "draft",
    conversion_goal: params.spec.conversion_goal,
    metadata: mergeFunnelPageMetadata({} as Json, {
      headline: params.spec.headline ?? null,
      promessa: params.spec.promessa ?? null,
      cta: params.spec.cta ?? null,
      product_id: params.context.productId,
      copylab_id: params.context.copylabId,
      operation_id: params.context.operationId,
      integrations: {
        landing_factory: Boolean(params.landing),
        offer_engine: Boolean(params.offer),
        copylab: Boolean(params.context.copylabId),
        creative_director: params.context.creativeContext.includes("Creative Director:"),
        funnel_engine: true,
      },
      ...params.extraMetadata,
    }),
  } satisfies Omit<TableInsert<"funnel_pages">, "user_id">);

  return { page: page ?? null, error: error ?? null };
}

async function createLandingForPage(
  context: PageGenerationContext,
  spec: GeneratedPageSpec
): Promise<LandingPage | null> {
  const { page } = await generateLandingPage({
    operation_id: context.operationId,
    product_id: context.productId,
    copylab_id: context.copylabId,
    titulo: spec.title,
    promessa: spec.promessa ?? context.promessa,
    avatar: context.avatar,
    problema: context.problema,
    solucao: context.solucao,
    headline: spec.headline,
  });
  return page;
}

export async function generateFrontEndPage(
  context: PageGenerationContext,
  repos: { pages: FunnelPagesRepository; landings: LandingPagesRepository }
): Promise<{ page: FunnelPage | null; landing: LandingPage | null; error: string | null }> {
  const offer = resolveOfferForPageType(context.offers, "front_end");
  const spec = await generatePageSpec(context, "front_end", offer);
  if (!spec) return { page: null, landing: null, error: "Não foi possível gerar front-end." };

  const landing = await createLandingForPage(context, spec);
  const { page, error } = await persistFunnelPage({
    repo: repos.pages,
    landingRepo: repos.landings,
    context,
    pageType: "front_end",
    offer,
    spec,
    landing,
  });

  return { page, landing, error };
}

export async function generateUpsellPage(
  context: PageGenerationContext,
  repos: { pages: FunnelPagesRepository; landings: LandingPagesRepository },
  upsellIndex = 0
): Promise<{ page: FunnelPage | null; landing: LandingPage | null; error: string | null }> {
  const offer = resolveOfferForPageType(context.offers, "upsell", upsellIndex);
  if (!offer && upsellIndex > 0) {
    return { page: null, landing: null, error: null };
  }

  const spec = await generatePageSpec(context, "upsell", offer, { upsell_index: upsellIndex });
  if (!spec) return { page: null, landing: null, error: "Não foi possível gerar upsell." };

  const landing = await createLandingForPage(context, {
    ...spec,
    title: upsellIndex > 0 ? `${spec.title} ${upsellIndex + 1}` : spec.title,
  });

  const { page, error } = await persistFunnelPage({
    repo: repos.pages,
    landingRepo: repos.landings,
    context,
    pageType: "upsell",
    offer,
    spec,
    landing,
    extraMetadata: { upsell_index: upsellIndex },
  });

  return { page, landing, error };
}

export async function generateDownsellPage(
  context: PageGenerationContext,
  repos: { pages: FunnelPagesRepository; landings: LandingPagesRepository }
): Promise<{ page: FunnelPage | null; landing: LandingPage | null; error: string | null }> {
  const offer = resolveOfferForPageType(context.offers, "downsell");
  if (!offer) return { page: null, landing: null, error: null };

  const spec = await generatePageSpec(context, "downsell", offer);
  if (!spec) return { page: null, landing: null, error: "Não foi possível gerar downsell." };

  const landing = await createLandingForPage(context, spec);
  const { page, error } = await persistFunnelPage({
    repo: repos.pages,
    landingRepo: repos.landings,
    context,
    pageType: "downsell",
    offer,
    spec,
    landing,
  });

  return { page, landing, error };
}

export async function generateThankYouPage(
  context: PageGenerationContext,
  repos: { pages: FunnelPagesRepository; landings: LandingPagesRepository }
): Promise<{ page: FunnelPage | null; landing: LandingPage | null; error: string | null }> {
  const spec = await generatePageSpec(context, "thank_you", null, {
    message: "Página de confirmação pós-compra.",
  });
  if (!spec) return { page: null, landing: null, error: "Não foi possível gerar thank you." };

  const landing = await createLandingForPage(context, {
    ...spec,
    title: `Obrigado — ${context.productName}`,
    promessa: "Sua compra foi confirmada. Acesse seu produto e bônus liberados.",
    cta: "Acessar meu produto",
  });

  const { page, error } = await persistFunnelPage({
    repo: repos.pages,
    landingRepo: repos.landings,
    context,
    pageType: "thank_you",
    offer: null,
    spec: {
      ...spec,
      conversion_goal: 1,
    },
    landing,
  });

  return { page, landing, error };
}

export async function generateQuizPage(
  context: PageGenerationContext,
  repos: { pages: FunnelPagesRepository; landings: LandingPagesRepository }
): Promise<{ page: FunnelPage | null; landing: LandingPage | null; error: string | null }> {
  const spec = await generatePageSpec(context, "quiz", null, {
    instruction: "Quiz de qualificação com 3-5 perguntas antes da oferta.",
  });
  if (!spec) return { page: null, landing: null, error: "Não foi possível gerar quiz." };

  const landing = await createLandingForPage(context, {
    ...spec,
    title: `Quiz — ${context.productName}`,
    promessa: "Responda o quiz e descubra se este método é ideal para você.",
    cta: "Ver meu resultado",
  });

  const { page, error } = await persistFunnelPage({
    repo: repos.pages,
    landingRepo: repos.landings,
    context,
    pageType: "quiz",
    offer: null,
    spec,
    landing,
    extraMetadata: { quiz_enabled: true },
  });

  return { page, landing, error };
}

async function generateOrderBumpPage(
  context: PageGenerationContext,
  repos: { pages: FunnelPagesRepository; landings: LandingPagesRepository }
): Promise<{ page: FunnelPage | null; landing: LandingPage | null; error: string | null }> {
  const offer = resolveOfferForPageType(context.offers, "order_bump");
  if (!offer) return { page: null, landing: null, error: null };

  const spec = await generatePageSpec(context, "order_bump", offer);
  if (!spec) return { page: null, landing: null, error: "Não foi possível gerar order bump." };

  const landing = await createLandingForPage(context, spec);
  const { page, error } = await persistFunnelPage({
    repo: repos.pages,
    landingRepo: repos.landings,
    context,
    pageType: "order_bump",
    offer,
    spec,
    landing,
  });

  return { page, landing, error };
}

async function generateWebinarPage(
  context: PageGenerationContext,
  repos: { pages: FunnelPagesRepository; landings: LandingPagesRepository }
): Promise<{ page: FunnelPage | null; landing: LandingPage | null; error: string | null }> {
  const spec = await generatePageSpec(context, "webinar", resolveOfferForPageType(context.offers, "front_end"), {
    instruction: "Página de inscrição para webinar ao vivo.",
  });
  if (!spec) return { page: null, landing: null, error: "Não foi possível gerar webinar." };

  const landing = await createLandingForPage(context, {
    ...spec,
    title: `Webinar — ${context.productName}`,
    cta: "Quero me inscrever",
  });

  const { page, error } = await persistFunnelPage({
    repo: repos.pages,
    landingRepo: repos.landings,
    context,
    pageType: "webinar",
    offer: resolveOfferForPageType(context.offers, "front_end"),
    spec,
    landing,
  });

  return { page, landing, error };
}

export async function generateFunnelPages(input: FunnelPagesIntake): Promise<{
  bundle: FunnelPagesBundle | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { bundle: null, error: "Usuário não autenticado." };
  if (!getOpenAi()) return { bundle: null, error: "IA indisponível (OPENAI_API_KEY)." };

  const funnelId = input.funnel_id?.trim();
  if (!funnelId) return { bundle: null, error: "Informe funnel_id." };

  const funnelsRepo = new FunnelsRepository(ctx.supabase, ctx.userId);
  const offersRepo = new OffersRepository(ctx.supabase, ctx.userId);
  const pagesRepo = new FunnelPagesRepository(ctx.supabase, ctx.userId);
  const landingRepo = new LandingPagesRepository(ctx.supabase, ctx.userId);
  const stepsRepo = new FunnelStepsRepository(ctx.supabase, ctx.userId);

  const { data: funnel, error: funnelError } = await funnelsRepo.findById(funnelId);
  if (funnelError || !funnel) {
    return { bundle: null, error: funnelError ?? "Funil não encontrado." };
  }

  await pagesRepo.deleteByFunnelId(funnelId);

  const [{ data: offers }, { data: steps }] = await Promise.all([
    offersRepo.findByFunnelId(funnelId),
    stepsRepo.findByFunnelId(funnelId),
  ]);

  const { context: pageContext, error: contextError } = await buildPageGenerationContext(
    funnel,
    input,
    offers ?? []
  );
  if (contextError || !pageContext) {
    return { bundle: null, error: contextError ?? "Erro ao montar contexto." };
  }

  const repos = { pages: pagesRepo, landings: landingRepo };
  const persistedPages: FunnelPage[] = [];
  const landings: LandingPage[] = [];

  const generators: Array<
    () => Promise<{ page: FunnelPage | null; landing: LandingPage | null; error: string | null }>
  > = [
    () => generateFrontEndPage(pageContext, repos),
    () => generateOrderBumpPage(pageContext, repos),
    () => generateUpsellPage(pageContext, repos, 0),
    () => generateUpsellPage(pageContext, repos, 1),
    () => generateDownsellPage(pageContext, repos),
  ];

  if (input.include_quiz ?? funnel.funnel_type === "tripwire") {
    generators.push(() => generateQuizPage(pageContext, repos));
  }

  if (input.include_webinar ?? funnel.funnel_type === "webinar") {
    generators.push(() => generateWebinarPage(pageContext, repos));
  }

  generators.push(() => generateThankYouPage(pageContext, repos));

  for (const run of generators) {
    const result = await run();
    if (result.error) {
      return { bundle: null, error: result.error };
    }
    if (result.page) persistedPages.push(result.page);
    if (result.landing) landings.push(result.landing);
  }

  const hasStepsWithoutPages = (steps ?? []).some(
    (step) => step.landing_id && !persistedPages.some((page) => page.landing_page_id === step.landing_id)
  );

  const bundle: FunnelPagesBundle = {
    funnel,
    pages: persistedPages,
    landings,
  };

  await funnelsRepo.update(funnel.id, {
    metadata: mergeFunnelPageMetadata(funnel.metadata, {
      funnel_pages: {
        total: persistedPages.length,
        generated_at: new Date().toISOString(),
        page_types: persistedPages.map((page) => page.page_type),
        linked_steps: hasStepsWithoutPages,
        aura_context: buildFunnelPagesAuraContext(bundle),
      },
    }) as Json,
  });

  recordSystemLog({
    tipo: "info",
    modulo: "funnel-pages",
    mensagem: `Páginas do funil geradas: ${funnel.funnel_name}`,
    detalhes: {
      funnelId: funnel.id,
      totalPages: persistedPages.length,
      landings: landings.length,
    },
  });

  void import("./excellence-integration.service")
    .then(({ scheduleExcellenceReviews }) => {
      scheduleExcellenceReviews(
        [
          { assetType: "funnel", assetId: funnel.id, label: funnel.funnel_name },
          ...landings.map((landing) => ({
            assetType: "landing" as const,
            assetId: landing.id,
            label: landing.title ?? landing.headline ?? undefined,
          })),
        ],
        "funnel-pages"
      );
    })
    .catch(() => undefined);

  if (funnel.product_id) {
    void import("./checkout-engine.service")
      .then((mod) => mod.applyCheckoutToProduct(funnel.product_id!))
      .catch((err) => console.error("[checkout-engine] funnel-pages hook failed", err));
  }

  return { bundle, error: null };
}

export async function getFunnelPagesDashboard(params?: {
  funnelId?: string | null;
}): Promise<{
  dashboard: FunnelPagesDashboard;
  bundles: FunnelPagesBundle[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      dashboard: {
        totalPages: 0,
        publishedPages: 0,
        expectedConversion: 0,
        bestPage: null,
      },
      bundles: [],
      error: "Usuário não autenticado.",
    };
  }

  const pagesRepo = new FunnelPagesRepository(ctx.supabase, ctx.userId);
  const funnelsRepo = new FunnelsRepository(ctx.supabase, ctx.userId);
  const landingRepo = new LandingPagesRepository(ctx.supabase, ctx.userId);

  const funnelId = params?.funnelId?.trim();
  const [{ data: pages, error }, { data: funnels }] = await Promise.all([
    funnelId ? pagesRepo.findByFunnelId(funnelId) : pagesRepo.findAllOrdered(),
    funnelsRepo.findAllOrdered(),
  ]);

  if (error) {
    return {
      dashboard: computeFunnelPagesDashboard({ pages: [] }),
      bundles: [],
      error,
    };
  }

  const funnelMap = new Map((funnels ?? []).map((f) => [f.id, f]));
  const funnelIds = funnelId
    ? [funnelId]
    : [...new Set((pages ?? []).map((page) => page.funnel_id))];

  const bundles: FunnelPagesBundle[] = [];
  for (const id of funnelIds) {
    const funnel = funnelMap.get(id);
    if (!funnel) continue;
    const funnelPages = funnelId
      ? (pages ?? [])
      : (pages ?? []).filter((page) => page.funnel_id === id);

    const landingIds = funnelPages
      .map((page) => page.landing_page_id)
      .filter((value): value is string => Boolean(value));

    const landings: LandingPage[] = [];
    for (const landingId of landingIds) {
      const { data: landing } = await landingRepo.findById(landingId);
      if (landing) landings.push(landing);
    }

    bundles.push({ funnel, pages: funnelPages, landings });
  }

  const primaryFunnel = funnelId ? funnelMap.get(funnelId) : funnels?.[0];
  const dashboard = computeFunnelPagesDashboard({
    pages: pages ?? [],
    funnelConversion: primaryFunnel?.expected_conversion,
  });

  return { dashboard, bundles, error: null };
}

export async function getFunnelPagesContext(): Promise<{ context: string; error: string | null }> {
  const { bundles, error } = await getFunnelPagesDashboard();
  if (error) return { context: "", error };
  if (!bundles.length) return { context: "Nenhuma página de funil gerada ainda.", error: null };
  return {
    context: bundles
      .slice(0, 3)
      .map((bundle) => buildFunnelPagesAuraContext(bundle))
      .join("\n\n---\n\n"),
    error: null,
  };
}
