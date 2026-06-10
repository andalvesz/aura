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
} from "@/types/database";
import {
  computeProductFactoryDashboard,
  PRODUCT_FILES_BUCKET,
  STORAGE_BUCKET_WARNING,
  type GeneratedProductFactory,
  type ProductFactoryBundle,
  type ProductFactoryDashboardMetrics,
  type ProductFactoryIntake,
} from "@/utils/product-factory";
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

  const { data, error } = await ctx.supabase.storage.listBuckets();
  if (error || !data) return false;
  return data.some((b) => b.id === PDF_BUCKET || b.name === PDF_BUCKET);
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

  const generated = await callProductFactoryAi<GeneratedProductFactory>(
    `Você é a Aura Product Factory — cria produtos digitais completos para o mercado brasileiro.
Tipo de produto: ${productType}
Responda APENAS JSON:
{
  "titulo": string,
  "subtitulo": string,
  "promessa": string,
  "publico": string,
  "objetivo": string,
  "capitulos": [{ "titulo": string, "resumo": string, "conteudo": string }],
  "conteudo": { "introducao": string, "metodologia": string, "proximos_passos": string },
  "exercicios": [{ "titulo": string, "instrucao": string, "reflexao": string }],
  "bonus": string,
  "checklist": [{ "item": string, "descricao": string }],
  "conclusao": string,
  "design": {
    "capa": string,
    "paleta": string[],
    "estilo_visual": string,
    "paginas_internas": string,
    "mockup_textual": string,
    "tipografia": string,
    "moodboard": string
  },
  "compliance": {
    "risk_score": number,
    "risk_level": "low" | "medium" | "high",
    "forbidden_claims": string[],
    "misleading_risks": string[],
    "ad_checklist": [{ "item": string, "status": "ok" | "atencao" | "bloqueado", "nota": string }],
    "recommendations": string[],
    "status": "pass" | "warning" | "fail",
    "notes": string
  }
}
Regras:
- Adapte estrutura ao tipo (${productType}): capítulos, dias ou módulos conforme o formato
- Mínimo 4 seções/capítulos com conteúdo prático
- Mínimo 3 exercícios quando aplicável
- Checklist final com 5+ itens acionáveis
- Design com paleta de 3-5 cores hex e layout textual
- Compliance rigoroso: nunca prometa resultados garantidos; evite claims médicos/financeiros proibidos
- Português do Brasil`,
    JSON.stringify({ intake: input, product_type: productType, integrations })
  );

  if (!generated?.titulo || !generated.capitulos?.length) {
    return { bundle: null, error: "Não foi possível gerar o e-book." };
  }

  const factoryRepo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
  const complianceRepo = new ProductComplianceChecksRepository(ctx.supabase, ctx.userId);
  const versionsRepo = new ProductVersionsRepository(ctx.supabase, ctx.userId);

  const conteudo = {
    ...generated.conteudo,
    ...(generated.proximos_passos ? { proximos_passos: generated.proximos_passos } : {}),
  };

  const { data: factory, error: createError } = await factoryRepo.create({
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
    capitulos: generated.capitulos,
    conteudo,
    exercicios: generated.exercicios,
    bonus: generated.bonus,
    checklist: generated.checklist,
    conclusao: generated.conclusao,
    design: generated.design,
    status: "design_ready",
    current_version: 1,
  } satisfies Omit<TableInsert<"product_factory">, "user_id">);

  if (createError || !factory) {
    return { bundle: null, error: createError ?? "Erro ao salvar produto." };
  }

  const compliance = generated.compliance;
  await complianceRepo.create({
    factory_id: factory.id,
    risk_score: compliance.risk_score,
    risk_level: compliance.risk_level,
    forbidden_claims: compliance.forbidden_claims,
    misleading_risks: compliance.misleading_risks,
    ad_checklist: compliance.ad_checklist,
    recommendations: compliance.recommendations,
    status: compliance.status,
    notes: compliance.notes,
  });

  await versionsRepo.create({
    factory_id: factory.id,
    version_number: 1,
    version_label: "rascunho",
    snapshot: {
      titulo: generated.titulo,
      promessa: generated.promessa,
      capitulos: generated.capitulos,
      design: generated.design,
    },
    changelog: "v1 — Rascunho gerado pela Aura Product Factory",
    file_id: null,
  });

  const bundle = await loadBundleForFactory(factory as ProductFactory);
  return { bundle, error: null };
}

export async function publishProductFactoryPdf(input: {
  factory_id: string;
  pdf_base64: string;
}): Promise<{
  file: ProductFile | null;
  bundle: ProductFactoryBundle | null;
  error: string | null;
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

  const factoryRepo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
  const filesRepo = new ProductFilesRepository(ctx.supabase, ctx.userId);
  const versionsRepo = new ProductVersionsRepository(ctx.supabase, ctx.userId);

  const { data: factory, error: findError } = await factoryRepo.findById(factoryId);
  if (findError || !factory) {
    return { file: null, bundle: null, error: findError ?? "Produto não encontrado." };
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
  const storagePath = `${ctx.userId}/${factoryId}/${slug}-v${nextVersion}.pdf`;
  const fileName = `${slug}-v${nextVersion}.pdf`;

  const { error: uploadError } = await ctx.supabase.storage
    .from(PDF_BUCKET)
    .upload(storagePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    return {
      file: null,
      bundle: null,
      error: STORAGE_BUCKET_WARNING,
    };
  }

  const { data: publicData } = ctx.supabase.storage.from(PDF_BUCKET).getPublicUrl(storagePath);
  const fileUrl = publicData.publicUrl;

  const { data: file, error: fileError } = await filesRepo.create({
    factory_id: factoryId,
    file_type: "pdf",
    storage_path: storagePath,
    file_url: fileUrl,
    file_name: fileName,
    mime_type: "application/pdf",
    size_bytes: pdfBytes.length,
    version_number: nextVersion,
  } satisfies Omit<TableInsert<"product_files">, "user_id">);

  if (fileError || !file) {
    return { file: null, bundle: null, error: fileError ?? "Erro ao registrar arquivo." };
  }

  await factoryRepo.update(factoryId, {
    current_version: nextVersion,
    status: "pdf_ready",
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
    file_id: file.id,
  });

  const { data: updatedFactory } = await factoryRepo.findById(factoryId);
  const bundle = updatedFactory
    ? await loadBundleForFactory(updatedFactory as ProductFactory)
    : null;

  return { file: file as ProductFile, bundle, error: null };
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
