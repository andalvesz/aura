import OpenAI from "openai";
import {
  ProductComplianceChecksRepository,
  ProductFactoryRepository,
  ProductFilesRepository,
  ProductVersionsRepository,
} from "@/lib/supabase/repositories/product-factory.repository";
import { loadAdsCampaigns } from "@/lib/supabase/services/ads-manager.service";
import { loadCopylabRecords } from "@/lib/supabase/services/copylab.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import { loadStudioAssets } from "@/lib/supabase/services/creative-studio.service";
import { getLaunchDashboard } from "@/lib/supabase/services/launch.service";
import { getLegacyContext } from "@/lib/supabase/services/legado.service";
import { loadLandingRecords } from "@/lib/supabase/services/landing-builder.service";
import { loadMoneyPlans } from "@/lib/supabase/services/money.service";
import { loadPerformanceInputData } from "@/lib/supabase/services/performance.service";
import { loadResearchRecords } from "@/lib/supabase/services/research.service";
import type {
  ProductComplianceCheck,
  ProductFactory,
  ProductFactoryType,
  ProductFile,
  ProductVersionLabel,
  TableInsert,
  Json,
} from "@/types/database";
import {
  computeProductFactoryDashboard,
  PRODUCT_FILES_BUCKET,
  STORAGE_BUCKET_WARNING,
  buildProductFactoryDownloadUrl,
  type GeneratedProductFactory,
  type ProductFactoryBundle,
  type ProductFactoryDashboardMetrics,
  type ProductFactoryIntake,
} from "@/utils/product-factory";
import {
  buildProActionPrompt,
  buildProGenerationSystemPrompt,
  computeProductQualityScore,
  detectSensitiveNiche,
  mergeQualityIntoContent,
  normalizeProGenerated,
  parseProContent,
  PRODUCT_NOT_READY_MESSAGE,
  type ProGeneratedProduct,
  type ProductFactoryProAction,
} from "@/utils/product-factory-pro";
import { probeStorageBucketWrite } from "@/lib/supabase/storage/bucket-probe";
import { applyWinnerPatternToSystemPrompt } from "@/utils/winner-pattern";
import { getWinnerContext } from "./winner-pattern.service";
import { getOptionalDataContext } from "./context";

const PDF_BUCKET = PRODUCT_FILES_BUCKET;

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

async function callProductFactoryAi<T>(system: string, user: string): Promise<T | null> {
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

function decodeBase64Pdf(base64: string): Uint8Array {
  const raw = base64.includes(",") ? base64.split(",")[1]! : base64;
  return new Uint8Array(Buffer.from(raw, "base64"));
}

async function buildIntegrationContext(): Promise<Record<string, unknown>> {
  const [
    { bundles },
    { records: researchRecords },
    { records: copyRecords },
    { records: landingRecords },
    { records: adsRecords },
    { records: studioRecords },
    { plans },
    { input: performanceInput },
    { dashboard: launchDashboard, center: launchCenter },
    { context: legacyContext },
  ] = await Promise.all([
    loadCreatorBundles(),
    loadResearchRecords(),
    loadCopylabRecords(),
    loadLandingRecords(),
    loadAdsCampaigns(),
    loadStudioAssets(),
    loadMoneyPlans(),
    loadPerformanceInputData(),
    getLaunchDashboard(),
    getLegacyContext(),
  ]);

  return {
    creator: bundles.slice(0, 4).map((b) => ({
      nome: b.product.nome,
      problema: b.product.problema,
      solucao: b.product.solucao,
      estagio: b.product.status,
    })),
    research: researchRecords.slice(0, 3).map((r) => ({
      nicho: r.nicho,
      avatar: r.avatar,
      nota: r.nota_final,
      diferencial: r.diferencial_sugerido,
    })),
    copylab: copyRecords.slice(0, 3).map((c) => ({
      nome: c.nome,
      promessa: c.promessa,
      headline: c.headline,
    })),
    launch: launchCenter
      ? {
          produto: launchDashboard?.produtoAtual ?? launchCenter.bundle?.product.nome,
          estagio: launchDashboard?.estagio ?? launchCenter.pipelineStep,
          checklist: launchDashboard?.checklistPercent,
        }
      : null,
    studio: studioRecords.slice(0, 3).map((s) => ({
      nome: s.nome,
      promessa: s.promessa,
      capa: s.capa_ebook ? "sim" : "não",
    })),
    landings: landingRecords.slice(0, 3).map((l) => ({
      nome: l.nome,
      modelo: l.modelo,
      headline: l.headline,
    })),
    ads: adsRecords.slice(0, 3).map((a) => ({
      nome: a.nome,
      campanha: a.campanha_nome,
      status: a.status,
    })),
    money: plans.slice(0, 2).map((p) => ({
      meta: p.valor_meta,
      prazo: p.prazo,
      status: p.status,
    })),
    legado: legacyContext ? legacyContext.slice(0, 500) : null,
    performance: performanceInput
      ? {
          metaProgresso: performanceInput.moneyDashboard.progressoPct,
          adsAtivos: performanceInput.adsDashboard.totalCampanhas,
          creatorProdutos: performanceInput.creatorDashboard.produtosCriados,
        }
      : null,
  };
}

export async function checkProductFilesBucketReady(): Promise<boolean> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return false;

  const probePath = `${ctx.userId}/product-factory-healthcheck/probe.txt`;

  return probeStorageBucketWrite({
    supabase: ctx.supabase,
    bucket: PDF_BUCKET,
    probePath,
    userId: ctx.userId,
    logPrefix: "[product-factory]",
  });
}

async function loadBundleForFactory(factory: ProductFactory): Promise<ProductFactoryBundle> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { factory, files: [], versions: [], compliance: null, latestPdf: null };
  }

  const filesRepo = new ProductFilesRepository(ctx.supabase, ctx.userId);
  const versionsRepo = new ProductVersionsRepository(ctx.supabase, ctx.userId);
  const complianceRepo = new ProductComplianceChecksRepository(ctx.supabase, ctx.userId);

  const [{ data: files }, { data: versions }, { data: compliance }, { data: latestPdf }] =
    await Promise.all([
      filesRepo.findByFactoryId(factory.id),
      versionsRepo.findByFactoryId(factory.id),
      complianceRepo.findLatestByFactoryId(factory.id),
      filesRepo.findLatestPdf(factory.id),
    ]);

  return {
    factory,
    files: files ?? [],
    versions: versions ?? [],
    compliance,
    latestPdf,
  };
}

export async function loadProductFactoryBundles(): Promise<{
  bundles: ProductFactoryBundle[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { bundles: [], error: "Usuário não autenticado." };

  const repo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findAllOrdered();
  if (error) return { bundles: [], error };

  const bundles = await Promise.all((data ?? []).map((f) => loadBundleForFactory(f)));
  return { bundles, error: null };
}

export async function getProductFactoryDashboard(): Promise<{
  dashboard: ProductFactoryDashboardMetrics | null;
  bundles: ProductFactoryBundle[];
  storageReady: boolean;
  error: string | null;
}> {
  const { bundles, error } = await loadProductFactoryBundles();
  if (error) return { dashboard: null, bundles: [], storageReady: false, error };
  const storageReady = await checkProductFilesBucketReady();

  return {
    dashboard: computeProductFactoryDashboard(bundles),
    bundles,
    storageReady,
    error: null,
  };
}

export type { ProductFactoryProAction } from "@/utils/product-factory-pro";

async function persistComplianceFromGenerated(
  complianceRepo: ProductComplianceChecksRepository,
  factoryId: string,
  compliance: GeneratedProductFactory["compliance"]
) {
  await complianceRepo.create({
    factory_id: factoryId,
    risk_score: compliance.risk_score,
    risk_level: compliance.risk_level,
    forbidden_claims: compliance.forbidden_claims,
    misleading_risks: compliance.misleading_risks,
    ad_checklist: compliance.ad_checklist,
    recommendations: compliance.recommendations,
    status: compliance.status,
    notes: compliance.notes,
  });
}

function buildFactoryPayloadFromPro(
  generated: ProGeneratedProduct,
  input: ProductFactoryIntake,
  productType: ProductFactoryType,
  sensitive: boolean
) {
  const { capitulos, conteudo, design } = normalizeProGenerated(generated, sensitive);
  return {
    product_id: input.product_id ?? null,
    copylab_id: input.copylab_id ?? null,
    research_id: input.research_id ?? null,
    product_type: productType,
    titulo: generated.titulo,
    subtitulo: generated.subtitulo ?? input.subtitulo ?? null,
    promessa: generated.promessa,
    avatar: input.avatar || null,
    publico: generated.publico ?? input.publico ?? null,
    objetivo: generated.objetivo ?? input.objetivo ?? null,
    problema: input.problema || null,
    solucao: input.solucao || null,
    capitulos,
    conteudo,
    exercicios: generated.exercicios ?? [],
    bonus: generated.bonus,
    checklist: generated.checklist ?? [],
    conclusao: generated.conclusao,
    design,
    status: "design_ready" as const,
  };
}

export function evaluateProductQuality(
  factory: ProductFactory,
  compliance?: ProductComplianceCheck | null
) {
  return computeProductQualityScore(factory, compliance ?? null);
}

export async function generateProductFactory(input: ProductFactoryIntake): Promise<{
  bundle: ProductFactoryBundle | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { bundle: null, error: "Usuário não autenticado." };
  if (!getOpenAi()) return { bundle: null, error: "IA indisponível (OPENAI_API_KEY)." };

  if (!input.titulo.trim() && !input.problema.trim()) {
    return { bundle: null, error: "Informe o título ou o problema do produto." };
  }

  const integrations = await buildIntegrationContext();
  const productType: ProductFactoryType = input.product_type ?? "ebook";
  const nicheText = `${input.titulo} ${input.promessa} ${input.problema} ${input.publico ?? ""}`;
  const sensitive = detectSensitiveNiche(nicheText);

  const { context: winnerContext, promptBlock } = await getWinnerContext({
    module: "product-factory",
    niche: input.publico ?? input.promessa,
  });

  const generated = await callProductFactoryAi<ProGeneratedProduct>(
    applyWinnerPatternToSystemPrompt(
      buildProGenerationSystemPrompt(productType, sensitive),
      promptBlock,
      "product-factory"
    ),
    JSON.stringify({
      intake: input,
      product_type: productType,
      integrations,
      pro_v1: true,
      winnerContext,
    })
  );

  if (!generated?.titulo || !generated.capitulos?.length) {
    return { bundle: null, error: "Não foi possível gerar o e-book." };
  }

  const factoryRepo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
  const complianceRepo = new ProductComplianceChecksRepository(ctx.supabase, ctx.userId);
  const versionsRepo = new ProductVersionsRepository(ctx.supabase, ctx.userId);

  const payload = buildFactoryPayloadFromPro(generated, input, productType, sensitive);

  const { data: factory, error: createError } = await factoryRepo.create({
    ...payload,
    conteudo: payload.conteudo as Json,
    current_version: 1,
  } satisfies Omit<TableInsert<"product_factory">, "user_id">);

  if (createError || !factory) {
    return { bundle: null, error: createError ?? "Erro ao salvar produto." };
  }

  await persistComplianceFromGenerated(complianceRepo, factory.id, generated.compliance);

  const draftFactory = { ...factory, ...payload, conteudo: payload.conteudo } as ProductFactory;
  const quality = computeProductQualityScore(draftFactory, {
    status: generated.compliance.status,
    risk_score: generated.compliance.risk_score,
    forbidden_claims: generated.compliance.forbidden_claims,
  } as ProductComplianceCheck);
  const enrichedContent = mergeQualityIntoContent(
    payload.conteudo as Record<string, unknown>,
    quality
  );
  await factoryRepo.update(factory.id, { conteudo: enrichedContent as Json });

  await versionsRepo.create({
    factory_id: factory.id,
    version_number: 1,
    version_label: "rascunho",
    snapshot: {
      titulo: generated.titulo,
      promessa: generated.promessa,
      capitulos: payload.capitulos,
      design: payload.design,
      quality_score: quality.score,
    },
    changelog: "v1 — Rascunho Pro V1 gerado pela Aura Product Factory",
    file_id: null,
  });

  const { data: refreshed } = await factoryRepo.findById(factory.id);
  const bundle = refreshed
    ? await loadBundleForFactory(refreshed as ProductFactory)
    : await loadBundleForFactory(draftFactory);

  const productId = refreshed?.product_id ?? input.product_id ?? factory.product_id;
  if (productId) {
    void import("./funnel-engine.service")
      .then((mod) =>
        mod.generateFunnel({
          product_id: productId,
          copylab_id: input.copylab_id ?? refreshed?.copylab_id ?? null,
          factory_id: refreshed?.id ?? factory.id,
          funnel_name: generated.titulo ?? input.titulo,
          niche: input.publico ?? input.avatar,
        })
      )
      .catch((err) => console.error("[funnel-engine] auto-generate failed", err));
  }

  void import("./excellence-integration.service")
    .then(({ scheduleExcellenceReview }) => {
      scheduleExcellenceReview(
        "ebook",
        refreshed?.id ?? factory.id,
        generated.titulo ?? input.titulo,
        "product-factory"
      );
    })
    .catch(() => undefined);

  return { bundle, error: null };
}

export async function runProductFactoryProAction(
  factoryId: string,
  action: ProductFactoryProAction
): Promise<{ bundle: ProductFactoryBundle | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { bundle: null, error: "Usuário não autenticado." };
  if (!getOpenAi()) return { bundle: null, error: "IA indisponível (OPENAI_API_KEY)." };

  const factoryRepo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
  const complianceRepo = new ProductComplianceChecksRepository(ctx.supabase, ctx.userId);
  const versionsRepo = new ProductVersionsRepository(ctx.supabase, ctx.userId);

  const { data: factory, error: findError } = await factoryRepo.findById(factoryId);
  if (findError || !factory) {
    return { bundle: null, error: findError ?? "Produto não encontrado." };
  }

  const record = factory as ProductFactory;
  const nicheText = `${record.titulo} ${record.promessa} ${record.problema} ${record.publico ?? ""}`;
  const sensitive =
    detectSensitiveNiche(nicheText) || !!parseProContent(record.conteudo).sensitive_niche;

  const { context: winnerContext, promptBlock } = await getWinnerContext({
    module: "product-factory",
    niche: record.publico ?? record.promessa,
  });

  const generated = await callProductFactoryAi<ProGeneratedProduct>(
    applyWinnerPatternToSystemPrompt(
      buildProGenerationSystemPrompt(record.product_type ?? "ebook", sensitive),
      promptBlock,
      "product-factory"
    ),
    `${buildProActionPrompt(action, record)}\n${JSON.stringify({ winnerContext })}`
  );

  if (!generated?.titulo || !generated.capitulos?.length) {
    return { bundle: null, error: "Não foi possível aplicar a ação Pro." };
  }

  const intake: ProductFactoryIntake = {
    titulo: record.titulo ?? "",
    subtitulo: record.subtitulo ?? "",
    promessa: record.promessa ?? "",
    avatar: record.avatar ?? "",
    publico: record.publico ?? "",
    objetivo: record.objetivo ?? "",
    problema: record.problema ?? "",
    solucao: record.solucao ?? "",
    product_type: record.product_type ?? "ebook",
    product_id: record.product_id,
    copylab_id: record.copylab_id,
    research_id: record.research_id,
  };

  const payload = buildFactoryPayloadFromPro(
    generated,
    intake,
    record.product_type ?? "ebook",
    sensitive
  );

  const nextVersion = record.current_version + 1;
  const previewBundle = await loadBundleForFactory(record);
  const quality = computeProductQualityScore(
    { ...record, ...payload, conteudo: payload.conteudo } as ProductFactory,
    previewBundle.compliance
  );
  const enrichedContent = mergeQualityIntoContent(
    payload.conteudo as Record<string, unknown>,
    quality
  );

  const { error: updateError } = await factoryRepo.update(factoryId, {
    ...payload,
    conteudo: enrichedContent as Json,
    current_version: nextVersion,
    status: quality.readyToSell ? "content_ready" : "design_ready",
  });

  if (updateError) return { bundle: null, error: updateError };

  if (action === "improve" || action === "premium" || action === "expand_content") {
    await persistComplianceFromGenerated(complianceRepo, factoryId, generated.compliance);
  }

  const actionLabels: Record<ProductFactoryProAction, string> = {
    improve: "Melhorar Produto",
    regenerate_design: "Regenerar Design",
    expand_content: "Expandir Conteúdo",
    premium: "Versão Premium",
  };

  await versionsRepo.create({
    factory_id: factoryId,
    version_number: nextVersion,
    version_label: nextVersion >= 3 ? "final" : nextVersion === 2 ? "revisado" : "rascunho",
    snapshot: {
      titulo: generated.titulo,
      promessa: generated.promessa,
      capitulos: payload.capitulos,
      design: payload.design,
      quality_score: quality.score,
      action,
    },
    changelog: `v${nextVersion} — ${actionLabels[action]} · score ${quality.score}`,
    file_id: null,
  });

  const { data: refreshed } = await factoryRepo.findById(factoryId);
  if (!refreshed) return { bundle: null, error: "Erro ao recarregar produto." };
  return { bundle: await loadBundleForFactory(refreshed as ProductFactory), error: null };
}

export async function publishProductFactoryPdf(input: {
  factory_id: string;
  pdf_base64: string;
  premium?: boolean;
}): Promise<{
  file: ProductFile | null;
  bundle: ProductFactoryBundle | null;
  error: string | null;
  qualityScore?: number;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { file: null, bundle: null, error: "Usuário não autenticado." };

  const factoryId = input.factory_id.trim();
  const pdfBase64 = input.pdf_base64.trim();
  if (!factoryId || !pdfBase64) {
    return { file: null, bundle: null, error: "factory_id e pdf_base64 são obrigatórios." };
  }

  const pdfBytes = decodeBase64Pdf(pdfBase64);
  if (pdfBytes.length < 100) {
    return { file: null, bundle: null, error: "PDF inválido." };
  }

  console.info("[ebook] pdf generated", {
    factoryId,
    sizeBytes: pdfBytes.length,
  });

  const factoryRepo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
  const filesRepo = new ProductFilesRepository(ctx.supabase, ctx.userId);
  const versionsRepo = new ProductVersionsRepository(ctx.supabase, ctx.userId);

  const { data: factory, error: findError } = await factoryRepo.findById(factoryId);
  if (findError || !factory) {
    return { file: null, bundle: null, error: findError ?? "Produto não encontrado." };
  }

  const bundlePreview = await loadBundleForFactory(factory as ProductFactory);
  const quality = computeProductQualityScore(factory as ProductFactory, bundlePreview.compliance);

  if (!quality.readyToSell) {
    console.warn("[product-factory] publish blocked by quality score", {
      factoryId,
      score: quality.score,
      issues: quality.issues,
    });
    return {
      file: null,
      bundle: bundlePreview,
      error: PRODUCT_NOT_READY_MESSAGE,
      qualityScore: quality.score,
    };
  }

  const { requireExcellenceDelivery } = await import("./excellence-integration.service");
  const specialistGate = await requireExcellenceDelivery("ebook", factoryId, {
    module: "product-factory",
  });
  if (!specialistGate.allowed) {
    return {
      file: null,
      bundle: bundlePreview,
      error: specialistGate.error ?? "E-book bloqueado pelo Specialist Engine.",
      qualityScore: specialistGate.result?.finalScore ?? quality.score,
    };
  }

  const storageReady = await checkProductFilesBucketReady();
  if (!storageReady) {
    return { file: null, bundle: null, error: STORAGE_BUCKET_WARNING };
  }

  const nextVersion = Math.max(factory.current_version + 1, 3);
  const versionLabel: ProductVersionLabel = "final";
  const slug = (factory.titulo ?? "ebook")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40);
  const premiumSuffix = input.premium ? "-premium" : "";
  const storagePath = `${ctx.userId}/${factoryId}/${slug}-v${nextVersion}${premiumSuffix}.pdf`;
  const fileName = `${slug}-v${nextVersion}${premiumSuffix}.pdf`;

  const { error: uploadError } = await ctx.supabase.storage
    .from(PDF_BUCKET)
    .upload(storagePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    console.error("[ebook] upload failed", {
      factoryId,
      bucket: PDF_BUCKET,
      storagePath,
      error: uploadError.message,
    });
    return {
      file: null,
      bundle: null,
      error: `Não foi possível salvar o PDF: ${uploadError.message}`,
    };
  }

  console.info("[ebook] uploaded", {
    factoryId,
    bucket: PDF_BUCKET,
    storagePath,
    sizeBytes: pdfBytes.length,
  });

  const { data: verifyDownload, error: verifyError } = await ctx.supabase.storage
    .from(PDF_BUCKET)
    .download(storagePath);

  if (verifyError || !verifyDownload) {
    console.error("[ebook] storage verify failed", {
      factoryId,
      storagePath,
      error: verifyError?.message,
    });
    return {
      file: null,
      bundle: null,
      error: "PDF enviado, mas não foi encontrado no Storage.",
    };
  }

  const { data: publicData } = ctx.supabase.storage.from(PDF_BUCKET).getPublicUrl(storagePath);
  const publicUrl = publicData.publicUrl;

  const { data: signedData, error: signedError } = await ctx.supabase.storage
    .from(PDF_BUCKET)
    .createSignedUrl(storagePath, 3600);

  console.info("[ebook] public url", {
    factoryId,
    storagePath,
    publicUrl,
    signedUrl: signedData?.signedUrl ?? null,
    signedError: signedError?.message ?? null,
  });

  const { data: file, error: fileError } = await filesRepo.create({
    factory_id: factoryId,
    file_type: "pdf",
    storage_path: storagePath,
    file_url: publicUrl,
    file_name: fileName,
    mime_type: "application/pdf",
    size_bytes: pdfBytes.length,
    version_number: nextVersion,
  } satisfies Omit<TableInsert<"product_files">, "user_id">);

  if (fileError || !file) {
    return { file: null, bundle: null, error: fileError ?? "Erro ao registrar arquivo." };
  }

  const downloadUrl = buildProductFactoryDownloadUrl(file.id);
  const { data: updatedFile, error: urlUpdateError } = await filesRepo.update(file.id, {
    file_url: downloadUrl,
  });

  if (urlUpdateError) {
    console.warn("[ebook] download url update failed", {
      fileId: file.id,
      downloadUrl,
      error: urlUpdateError,
    });
  }

  const persistedFile = (updatedFile as ProductFile | null) ?? (file as ProductFile);

  await factoryRepo.update(factoryId, {
    current_version: nextVersion,
    status: "pdf_ready",
    conteudo: mergeQualityIntoContent(
      (factory.conteudo as Record<string, unknown>) ?? {},
      quality,
      { ready_to_sell: true }
    ) as Json,
  });

  await versionsRepo.create({
    factory_id: factoryId,
    version_number: nextVersion,
    version_label: versionLabel,
    snapshot: {
      titulo: factory.titulo,
      promessa: factory.promessa,
      capitulos: factory.capitulos,
      design: factory.design,
    },
    changelog: `v${nextVersion} — Final · PDF publicado`,
    file_id: persistedFile.id,
  });

  const { data: updatedFactory } = await factoryRepo.findById(factoryId);
  const bundle = updatedFactory
    ? await loadBundleForFactory(updatedFactory as ProductFactory)
    : null;

  return { file: persistedFile, bundle, error: null, qualityScore: quality.score };
}

export async function downloadProductFactoryPdf(fileId: string): Promise<{
  buffer: ArrayBuffer | null;
  fileName: string;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { buffer: null, fileName: "ebook.pdf", error: "Usuário não autenticado." };

  const trimmedId = fileId.trim();
  if (!trimmedId) {
    return { buffer: null, fileName: "ebook.pdf", error: "ID do arquivo inválido." };
  }

  console.info("[ebook] download requested", { fileId: trimmedId, userId: ctx.userId });

  const filesRepo = new ProductFilesRepository(ctx.supabase, ctx.userId);
  const { data: file, error: findError } = await filesRepo.findById(trimmedId);

  if (findError || !file) {
    console.warn("[ebook] download file not found", {
      fileId: trimmedId,
      error: findError,
    });
    return { buffer: null, fileName: "ebook.pdf", error: findError ?? "Arquivo não encontrado." };
  }

  const record = file as ProductFile;
  if (!record.storage_path?.trim()) {
    return { buffer: null, fileName: record.file_name ?? "ebook.pdf", error: "Caminho do PDF ausente." };
  }

  console.info("[ebook] download resolved", {
    fileId: record.id,
    factoryId: record.factory_id,
    storagePath: record.storage_path,
    bucket: PDF_BUCKET,
  });

  const { requireExcellenceDelivery } = await import("./excellence-integration.service");
  const excellenceGate = await requireExcellenceDelivery("ebook", record.factory_id, {
    module: "product-factory",
  });
  if (!excellenceGate.allowed) {
    return {
      buffer: null,
      fileName: record.file_name ?? "ebook.pdf",
      error: excellenceGate.error ?? "Download bloqueado pelo Aura Excellence Engine.",
    };
  }

  const { data: blob, error: downloadError } = await ctx.supabase.storage
    .from(PDF_BUCKET)
    .download(record.storage_path);

  if (downloadError || !blob) {
    console.error("[ebook] download storage failed", {
      fileId: record.id,
      storagePath: record.storage_path,
      error: downloadError?.message,
    });
    return {
      buffer: null,
      fileName: record.file_name ?? "ebook.pdf",
      error: downloadError?.message ?? "Arquivo PDF não encontrado no Storage.",
    };
  }

  return {
    buffer: await blob.arrayBuffer(),
    fileName: record.file_name ?? "ebook.pdf",
    error: null,
  };
}

export async function runProductFactoryCompliance(factoryId: string): Promise<{
  compliance: ProductComplianceCheck | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { compliance: null, error: "Usuário não autenticado." };
  if (!getOpenAi()) return { compliance: null, error: "IA indisponível (OPENAI_API_KEY)." };

  const factoryRepo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
  const complianceRepo = new ProductComplianceChecksRepository(ctx.supabase, ctx.userId);
  const versionsRepo = new ProductVersionsRepository(ctx.supabase, ctx.userId);

  const { data: factory, error: findError } = await factoryRepo.findById(factoryId);
  if (findError || !factory) {
    return { compliance: null, error: findError ?? "Produto não encontrado." };
  }

  const generated = await callProductFactoryAi<GeneratedProductFactory["compliance"]>(
    `Você é auditor de compliance para anúncios de produtos digitais no Brasil (Meta, Google, CONAR).
Analise promessa e conteúdo. Responda APENAS JSON com campos compliance:
{
  "risk_score": number,
  "risk_level": "low" | "medium" | "high",
  "forbidden_claims": string[],
  "misleading_risks": string[],
  "ad_checklist": [{ "item": string, "status": "ok" | "atencao" | "bloqueado", "nota": string }],
  "recommendations": string[],
  "status": "pass" | "warning" | "fail",
  "notes": string
}`,
    JSON.stringify({
      titulo: factory.titulo,
      promessa: factory.promessa,
      capitulos: factory.capitulos,
      bonus: factory.bonus,
    })
  );

  if (!generated) {
    return { compliance: null, error: "Não foi possível analisar compliance." };
  }

  const { data: compliance, error: createError } = await complianceRepo.create({
    factory_id: factoryId,
    risk_score: generated.risk_score,
    risk_level: generated.risk_level,
    forbidden_claims: generated.forbidden_claims,
    misleading_risks: generated.misleading_risks,
    ad_checklist: generated.ad_checklist,
    recommendations: generated.recommendations,
    status: generated.status,
    notes: generated.notes,
  });

  if (createError || !compliance) {
    return { compliance: null, error: createError ?? "Erro ao salvar compliance." };
  }

  if (factory.current_version < 2) {
    await factoryRepo.update(factoryId, { current_version: 2, status: "content_ready" });
    await versionsRepo.create({
      factory_id: factoryId,
      version_number: 2,
      version_label: "revisado",
      snapshot: {
        titulo: factory.titulo,
        promessa: factory.promessa,
        capitulos: factory.capitulos,
        compliance: generated,
      },
      changelog: "v2 — Revisado · compliance atualizado",
      file_id: null,
    });
  }

  return { compliance: compliance as ProductComplianceCheck, error: null };
}

export async function deleteProductFactoryRecord(id: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.delete(id);
  return { error };
}

export async function getProductFactoryContext(): Promise<{ context: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { context: "", error: "Usuário não autenticado." };

  const [{ bundles }, integrations] = await Promise.all([
    loadProductFactoryBundles(),
    buildIntegrationContext(),
  ]);

  const summary =
    bundles.length > 0
      ? bundles
          .slice(0, 4)
          .map(
            (b) =>
              `• ${b.factory.titulo ?? "Produto"} — ${b.factory.status} · PDF: ${b.latestPdf ? "sim" : "não"} · compliance: ${b.compliance?.status ?? "—"}`
          )
          .join("\n")
      : "Nenhum produto na Product Factory.";

  return {
    context: `## AURA PRODUCT FACTORY\n${summary}\n\n## INTEGRAÇÕES\n${JSON.stringify(integrations, null, 2)}`,
    error: null,
  };
}
