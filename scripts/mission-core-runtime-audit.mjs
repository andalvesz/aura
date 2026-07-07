/**
 * Mission Core Runtime Audit — executa missão real e valida artefatos.
 * Uso: node --import tsx scripts/mission-core-runtime-audit.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { computeProductQualityScore } from "../utils/product-factory-pro.ts";
import { evaluateReadyToSellCertification } from "../utils/revenue-certification.ts";
import { readMasterFlowMetadata } from "../utils/master-flow.ts";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function grade(status) {
  if (status === "green") return "VERDE";
  if (status === "yellow") return "AMARELO";
  return "VERMELHO";
}

async function ensureAuth(supabase) {
  const email = process.env.AURA_AUDIT_EMAIL ?? `aura.audit.${Date.now()}@mailinator.com`;
  const password = process.env.AURA_AUDIT_PASSWORD ?? `AuraAudit!${Date.now().toString(36)}`;

  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (!signIn.error && signIn.data.session) return signIn.data.session;

  const signUp = await supabase.auth.signUp({ email, password });
  if (signUp.error) throw new Error(`Auth falhou: ${signUp.error.message}`);
  if (signUp.data.session) return signUp.data.session;

  const retry = await supabase.auth.signInWithPassword({ email, password });
  if (retry.error || !retry.data.session) {
    throw new Error(`Auth falhou após signup: ${retry.error?.message ?? "sem sessão"}`);
  }
  return retry.data.session;
}

async function fetchArtifact(supabase, table, id, userId) {
  if (!id) return null;
  const { data, error } = await supabase.from(table).select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`${table}/${id}: ${error.message}`);
  return data;
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 10;
}

function assessCopy(record) {
  if (!record) return { status: "red", notes: "Registro ausente" };
  const fields = [record.headline, record.subheadline, record.body, record.cta, record.promessa].filter(Boolean);
  const text = fields.join(" ");
  if (text.length < 80) return { status: "yellow", notes: `Copy curta (${text.length} chars)` };
  return { status: "green", notes: `Copy gerada (${text.length} chars)` };
}

function assessOffer(offer) {
  if (!offer) return { status: "red", notes: "Oferta ausente" };
  const hasPrice = offer.price != null && offer.price > 0;
  const hasTitle = isNonEmptyString(offer.title);
  if (!hasTitle) return { status: "red", notes: "Oferta sem título" };
  if (!hasPrice) return { status: "yellow", notes: "Oferta sem preço definido" };
  return { status: "green", notes: `Oferta "${offer.title}" — ${offer.price}` };
}

function assessLanding(landing) {
  if (!landing) return { status: "red", notes: "Landing ausente" };
  const hasHeadline = isNonEmptyString(landing.headline ?? landing.title);
  const hasBody = isNonEmptyString(landing.hero_copy ?? landing.subheadline);
  if (!hasHeadline) return { status: "red", notes: "Landing sem headline" };
  if (!hasBody) return { status: "yellow", notes: "Landing com headline mas corpo fraco" };
  return { status: "green", notes: `Landing "${landing.headline ?? landing.title}"` };
}

function assessCampaign(campaign) {
  if (!campaign) return { status: "red", notes: "Campanha ausente" };
  const hasName = isNonEmptyString(campaign.name ?? campaign.titulo);
  if (!hasName) return { status: "yellow", notes: "Campanha criada mas sem nome claro" };
  return { status: "green", notes: `Campanha "${campaign.name ?? campaign.titulo}" — status ${campaign.status}` };
}

function assessCreatives(asset, generated) {
  if (!asset && (!generated || generated.length === 0)) {
    return { status: "red", notes: "Nenhum criativo encontrado" };
  }
  if (generated?.length > 0) {
    return { status: "green", notes: `${generated.length} criativo(s) gerado(s)` };
  }
  return { status: "yellow", notes: "Asset vinculado mas sem generated_assets" };
}

function installAuditContext(ctx) {
  const original = globalThis.__AURA_AUDIT_CTX__;
  globalThis.__AURA_AUDIT_CTX__ = ctx;
  return () => {
    globalThis.__AURA_AUDIT_CTX__ = original;
  };
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const openai = process.env.OPENAI_API_KEY?.trim();

if (!url || !anon) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, anon);
const intent = { raw: "Quero criar um negócio de emagrecimento para mulheres 40+" };

const report = {
  timestamp: new Date().toISOString(),
  intent: intent.raw,
  environment: { openai_configured: Boolean(openai) },
  mission: null,
  artifacts: {},
  validations: [],
  masked_errors: [],
  sellable: null,
};

try {
  const session = await ensureAuth(supabase);
  const userId = session.user.id;
  report.auth = { user_id: userId, email: session.user.email };

  const ctx = { user: session.user, supabase, userId };
  const restore = installAuditContext(ctx);

  let missionPayload;
  try {
    const { startMission } = await import("../lib/supabase/services/master-flow.service.ts");
    const result = await startMission(intent);
    missionPayload = { success: Boolean(result.mission), mission: result.mission, error: result.error };
  } finally {
    restore();
  }

  report.execution_mode = "direct_service_with_audit_context";

  if (!missionPayload?.mission) {
    report.fatal = missionPayload?.error ?? "Missão não retornada";
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const mission = missionPayload.mission;
  const flowRow = await fetchArtifact(supabase, "master_flows", mission.flow_id, userId);
  const flowMeta = flowRow ? readMasterFlowMetadata(flowRow) : {};

  const productId = mission.artifacts.product.id ?? flowRow?.product_id;
  const factory = flowMeta.factory_id
    ? await fetchArtifact(supabase, "product_factory", flowMeta.factory_id, userId)
    : null;
  const product = productId ? await fetchArtifact(supabase, "creator_products", productId, userId) : null;
  const offer = flowMeta.offer_id ? await fetchArtifact(supabase, "offers", flowMeta.offer_id, userId) : null;
  const landing = flowMeta.landing_id
    ? await fetchArtifact(supabase, "landing_pages", flowMeta.landing_id, userId)
    : null;
  const copy = flowMeta.copylab_id
    ? await fetchArtifact(supabase, "creator_copylab", flowMeta.copylab_id, userId)
    : null;
  const creative = flowMeta.creative_asset_id
    ? await fetchArtifact(supabase, "creative_assets", flowMeta.creative_asset_id, userId)
    : null;
  const { data: generatedCreatives } = flowMeta.operation_id
    ? await supabase
        .from("creative_generated_assets")
        .select("*")
        .eq("user_id", userId)
        .eq("operation_id", flowMeta.operation_id)
    : { data: [] };
  const campaignId = mission.artifacts.campaign.id ?? flowRow?.campaign_id;
  const campaign = campaignId ? await fetchArtifact(supabase, "ad_campaigns", campaignId, userId) : null;

  report.mission_runtime = {
    status: mission.status,
    current_step: mission.current_step,
    completed_steps: mission.completed_steps,
    failed_step: mission.failed_step,
    blocked_reason: mission.blocked_reason,
    is_ready_for_review: mission.is_ready_for_review,
    next_action: mission.next_action,
    pendencies: mission.pendencies,
    knowledge_warnings: mission.knowledge_warnings,
    api_error: missionPayload.error,
    flow_last_error: flowMeta.last_error ?? null,
  };

  report.artifacts = {
    product: product ? { id: product.id, nome: product.nome, status: product.status } : null,
    factory: factory
      ? { id: factory.id, titulo: factory.titulo, quality_score: factory.quality_score, pro_version: factory.pro_version }
      : null,
    offer: offer
      ? { id: offer.id, title: offer.title, price: offer.price, offer_type: offer.offer_type }
      : null,
    landing: landing
      ? {
          id: landing.id,
          headline: landing.headline,
          title: landing.title,
          status: landing.status,
          published_url: landing.published_url,
        }
      : null,
    copy: copy
      ? {
          id: copy.id,
          headline: copy.headline,
          subheadline: copy.subheadline,
          body_len: copy.body?.length ?? 0,
        }
      : null,
    creative: creative ? { id: creative.id, titulo: creative.titulo, asset_type: creative.asset_type } : null,
    generated_creatives_count: generatedCreatives?.length ?? 0,
    campaign: campaign
      ? { id: campaign.id, name: campaign.name, titulo: campaign.titulo, status: campaign.status }
      : null,
    checkout_url: flowMeta.checkout_url ?? null,
  };

  let productQuality = null;
  if (factory) {
    productQuality = computeProductQualityScore(factory);
    report.artifacts.product_quality = {
      score: productQuality.score,
      readyToSell: productQuality.readyToSell,
      issues: productQuality.issues,
    };
  }

  const productAssess =
    !factory && !product
      ? { status: "red", notes: "Produto não criado" }
      : productQuality?.readyToSell
        ? { status: "green", notes: `Score ${productQuality.score} — ready_to_sell` }
        : productQuality
          ? { status: "yellow", notes: `Score ${productQuality.score} — abaixo do gate 85 (${(productQuality.issues ?? []).slice(0, 2).join("; ")})` }
          : { status: "yellow", notes: "Produto criado sem factory/quality score" };

  const validations = [
    { id: 1, item: "Produto existe e tem qualidade comercial", ...productAssess },
    { id: 2, item: "Oferta está clara", ...assessOffer(offer) },
    { id: 3, item: "Landing foi gerada", ...assessLanding(landing) },
    { id: 4, item: "Copy foi gerada", ...assessCopy(copy) },
    { id: 5, item: "Criativos foram gerados", ...assessCreatives(creative, generatedCreatives) },
    { id: 6, item: "Campanha foi preparada", ...assessCampaign(campaign) },
    {
      id: 7,
      item: "Mission Result mostra tudo corretamente",
      status:
        mission.is_ready_for_review && (mission.publication_checklist?.length ?? 0) >= 6
          ? "green"
          : mission.artifacts?.product?.id
            ? "yellow"
            : "red",
      notes: `is_ready_for_review=${mission.is_ready_for_review}, checklist=${mission.publication_checklist?.length ?? 0}, blocked=${Boolean(mission.blocked_reason)}`,
    },
    {
      id: 8,
      item: "Nenhum ativo vazio",
      status: [productAssess, assessOffer(offer), assessLanding(landing), assessCopy(copy), assessCreatives(creative, generatedCreatives), assessCampaign(campaign)].some(
        (v) => v.status === "red"
      )
        ? "red"
        : [productAssess, assessOffer(offer), assessLanding(landing), assessCopy(copy), assessCreatives(creative, generatedCreatives), assessCampaign(campaign)].some(
              (v) => v.status === "yellow"
            )
          ? "yellow"
          : "green",
      notes: "Consolidação dos 6 ativos principais",
    },
    {
      id: 9,
      item: "Nenhum erro mascarado como sucesso",
      status:
        mission.status === "failed" && missionPayload.success
          ? "red"
          : missionPayload.error && mission.is_complete
            ? "red"
            : missionPayload.error && mission.artifacts?.product?.id
              ? "yellow"
              : "green",
      notes: `API success=${missionPayload.success}, error=${missionPayload.error ?? "null"}, flow_status=${mission.status}, failed_step=${mission.failed_step ?? "null"}`,
    },
  ];

  const cert = evaluateReadyToSellCertification({
    product_score: productQuality?.score ?? 0,
    excellence_score: flowMeta.excellence_score ?? flowMeta.commercial_excellence_score ?? 0,
    checkout_url: flowMeta.checkout_url ?? null,
    funnel_url: flowMeta.funnel_url ?? null,
    landing_url: flowMeta.landing_url ?? null,
    campaign_id: campaignId,
    creative_score: generatedCreatives?.length ? 85 : 0,
    campaign_score: campaign ? 85 : 0,
  });

  validations.push({
    id: 10,
    item: "Pacote final é vendável",
    status: cert.ready ? "green" : cert.commercial_status === "incomplete" && (productQuality?.score ?? 0) >= 70 ? "yellow" : "red",
    notes: `ready_to_sell=${cert.ready}, gaps=${cert.gaps.join("; ") || "nenhum"}`,
  });

  report.validations = validations.map((v) => ({ ...v, grade: grade(v.status) }));

  report.sellable = {
    ready_to_sell: cert.ready,
    commercial_status: cert.commercial_status,
    gaps: cert.gaps,
    pendencies: mission.pendencies,
  };

  if (missionPayload.error && mission.status !== "failed") report.masked_errors.push(missionPayload.error);
  if (flowMeta.last_error && mission.status !== "failed") report.masked_errors.push(flowMeta.last_error);

  report.summary = {
    green: report.validations.filter((v) => v.status === "green").length,
    yellow: report.validations.filter((v) => v.status === "yellow").length,
    red: report.validations.filter((v) => v.status === "red").length,
    mission_status: mission.status,
    current_step: mission.current_step,
    blocked_reason: mission.blocked_reason,
  };
} catch (err) {
  report.fatal = err instanceof Error ? err.message : String(err);
  report.stack = err instanceof Error ? err.stack : null;
}

console.log(JSON.stringify(report, null, 2));
if (report.fatal) process.exit(1);
