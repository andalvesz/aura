/**
 * Aura Core Runtime Certification
 *
 * Executa missão real no pipeline completo:
 * Opportunity → Validation → Product Strategy → Decision → Product Factory
 * → Sales System → Investment Committee → Mission Review
 *
 * Uso:
 *   node --use-system-ca --import tsx scripts/aura-core-runtime-certification.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { MASTER_FLOW_STEPS } from "../utils/master-flow.ts";
import { readMasterFlowMetadata } from "../utils/master-flow.ts";
import { computeProductQualityScore } from "../utils/product-factory-pro.ts";
import { evaluateReadyToSell } from "../utils/sales-system.ts";
import { evaluateReadyToSellCertification, validateCheckoutUrl } from "../utils/revenue-certification.ts";

const TEST_MISSION =
  "Quero criar um produto digital para ganhar R$10.000 por mês com IA para pequenos negócios.";

const PIPELINE_STEPS = [
  "opportunity_engine",
  "validation_engine",
  "product_strategist",
  "decision_engine",
  "product_factory",
  "sales_system",
  "investment_committee",
  "mission_review",
];

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

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 10;
}

function stageResult(etapa, { status, score = null, evidencia, erro = null }) {
  return { etapa, status, score, evidencia, erro };
}

function pass(etapa, score, evidencia) {
  return stageResult(etapa, { status: "PASS", score, evidencia });
}

function fail(etapa, evidencia, erro, score = null) {
  return stageResult(etapa, { status: "FAIL", score, evidencia, erro });
}

async function ensureAuth(supabase, supabaseUrl) {
  const email =
    process.env.AURA_AUDIT_EMAIL?.trim() ?? "aura.core.runtime.cert@mailinator.com";
  const password =
    process.env.AURA_AUDIT_PASSWORD?.trim() ?? "AuraCoreRuntimeCert!2026";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  async function signIn() {
    return supabase.auth.signInWithPassword({ email, password });
  }

  let attempt = await signIn();
  if (!attempt.error && attempt.data.session) return attempt.data.session;

  if (serviceRole && supabaseUrl) {
    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = existing.data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase()
    );

    if (found) {
      await admin.auth.admin.updateUserById(found.id, {
        password,
        email_confirm: true,
      });
    } else {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error) {
        throw new Error(`Provisionamento admin falhou: ${created.error.message}`);
      }
    }

    attempt = await signIn();
    if (!attempt.error && attempt.data.session) return attempt.data.session;
  }

  const signUp = await supabase.auth.signUp({ email, password });
  if (signUp.data.session) return signUp.data.session;

  if (signUp.error && !/already registered|already exists/i.test(signUp.error.message)) {
    throw new Error(
      `Auth falhou no signup: ${signUp.error.message}. Defina AURA_AUDIT_EMAIL, AURA_AUDIT_PASSWORD e opcionalmente SUPABASE_SERVICE_ROLE_KEY no .env.local.`
    );
  }

  attempt = await signIn();
  if (!attempt.error && attempt.data.session) return attempt.data.session;

  throw new Error(
    attempt.error?.message ??
      "Auth falhou. Configure AURA_AUDIT_EMAIL e AURA_AUDIT_PASSWORD com um usuário confirmado, ou adicione SUPABASE_SERVICE_ROLE_KEY para provisionamento automático."
  );
}

async function fetchRow(supabase, table, id, userId) {
  if (!id) return null;
  const { data, error } = await supabase.from(table).select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`${table}/${id}: ${error.message}`);
  return data;
}

function installAuditContext(ctx) {
  const original = globalThis.__AURA_AUDIT_CTX__;
  globalThis.__AURA_AUDIT_CTX__ = ctx;
  return () => {
    globalThis.__AURA_AUDIT_CTX__ = original;
  };
}

function assessProductContent(factory) {
  if (!factory) return { ok: false, reason: "Factory ausente" };
  const title = factory.titulo?.trim() ?? "";
  const content = JSON.stringify(factory.conteudo ?? {});
  if (!isNonEmptyString(title)) return { ok: false, reason: "Produto sem título" };
  if (content.length < 120) return { ok: false, reason: `Conteúdo insuficiente (${content.length} chars)` };
  return { ok: true, reason: `Produto "${title}" com ${content.length} chars de conteúdo` };
}

function assessCopy(copy) {
  if (!copy) return { ok: false, reason: "Copy ausente" };
  const text = [copy.headline, copy.subheadline, copy.body, copy.cta, copy.promessa].filter(Boolean).join(" ");
  if (text.length < 80) return { ok: false, reason: `Copy curta (${text.length} chars)` };
  return { ok: true, reason: `Copy gerada (${text.length} chars)` };
}

function assessLanding(landing) {
  if (!landing) return { ok: false, reason: "Landing ausente" };
  const headline = landing.headline ?? landing.title ?? "";
  const body = landing.hero_copy ?? landing.subheadline ?? "";
  if (!isNonEmptyString(headline)) return { ok: false, reason: "Landing sem headline" };
  if (!isNonEmptyString(body) && !isNonEmptyString(landing.subheadline)) {
    return { ok: false, reason: "Landing sem corpo" };
  }
  return { ok: true, reason: `Landing "${headline}"` };
}

function assessOffer(offer) {
  if (!offer) return { ok: false, reason: "Oferta ausente" };
  if (!isNonEmptyString(offer.title)) return { ok: false, reason: "Oferta sem título" };
  if (!(offer.price > 0)) return { ok: false, reason: "Oferta sem preço" };
  return { ok: true, reason: `Oferta "${offer.title}" — R$ ${offer.price}` };
}

function buildStageReport({ mission, meta, flowRow, artifacts, productQuality, apiError }) {
  const stages = [];
  const completed = new Set(mission?.completed_steps ?? []);

  const stepCompleted = (step) => completed.has(step);

  // 1. Opportunity
  const opportunityScore =
    meta.selected_opportunity?.opportunityScore?.total ??
    meta.opportunity_engine_score ??
    null;
  if (!stepCompleted("opportunity_engine") || opportunityScore == null) {
    stages.push(
      fail(
        "opportunity_engine",
        `completed=${stepCompleted("opportunity_engine")}`,
        meta.last_error ?? apiError ?? "Opportunity Engine não concluída",
        opportunityScore
      )
    );
  } else {
    stages.push(
      pass(
        "opportunity_engine",
        Math.round(opportunityScore),
        meta.selected_opportunity?.title ?? meta.opportunity_name ?? "Oportunidade selecionada"
      )
    );
  }

  // 2. Validation
  const validationScore = meta.validation_score ?? null;
  if (!stepCompleted("validation_engine") || meta.validation_approved !== true) {
    stages.push(
      fail(
        "validation_engine",
        `approved=${meta.validation_approved}, score=${validationScore}`,
        meta.validation_recommendation ?? meta.last_error ?? "Validação reprovada ou incompleta",
        validationScore
      )
    );
  } else {
    stages.push(
      pass(
        "validation_engine",
        Math.round(validationScore ?? 0),
        meta.validation_recommendation ?? "Oportunidade validada"
      )
    );
  }

  // 3. Product Strategy
  const strategy = meta.selected_strategy;
  if (!stepCompleted("product_strategist") || !strategy) {
    stages.push(
      fail(
        "product_strategist",
        `completed=${stepCompleted("product_strategist")}`,
        meta.last_error ?? "Estratégia não escolhida",
        meta.product_strategist_score ?? null
      )
    );
  } else {
    stages.push(
      pass(
        "product_strategist",
        Math.round(strategy.scores?.total ?? meta.product_strategist_score ?? 0),
        `${strategy.strategyName} (${strategy.strategyType}) — ticket R$ ${strategy.ticket}`
      )
    );
  }

  // 4. Decision
  if (!stepCompleted("decision_engine")) {
    stages.push(
      fail(
        "decision_engine",
        `completed=false`,
        meta.decision_reason ?? meta.last_error ?? "Decision Engine não concluída",
        meta.decision_score ?? null
      )
    );
  } else {
    stages.push(
      pass(
        "decision_engine",
        meta.decision_score != null ? Math.round(meta.decision_score) : null,
        meta.decision_reason ?? "Decisão consolidada"
      )
    );
  }

  // 5. Product Factory
  const productAssess = assessProductContent(artifacts.factory);
  if (!stepCompleted("product_factory") || !productAssess.ok) {
    stages.push(
      fail(
        "product_factory",
        productAssess.reason,
        meta.last_error ?? productAssess.reason,
        productQuality?.score ?? meta.product_quality_score ?? null
      )
    );
  } else {
    stages.push(
      pass(
        "product_factory",
        Math.round(productQuality?.score ?? meta.product_quality_score ?? 0),
        productAssess.reason
      )
    );
  }

  // 6. Sales Package + Commercial Score
  const salesPackage = meta.sales_package;
  const offerAssess = assessOffer(artifacts.offer);
  const landingAssess = assessLanding(artifacts.landing);
  const copyAssess = assessCopy(artifacts.copy);
  const checkoutOk = validateCheckoutUrl(meta.checkout_url);
  const creativesOk = Boolean(meta.creative_asset_id) || (artifacts.generatedCreativesCount ?? 0) > 0;
  const commercialScore = meta.commercial_score ?? salesPackage?.commercialScore ?? null;

  const salesAssetsReady =
    salesPackage?.product?.ready &&
    salesPackage?.offer?.ready &&
    salesPackage?.landing?.ready &&
    salesPackage?.copy?.ready &&
    salesPackage?.creativePackage?.ready &&
    salesPackage?.checkout?.ready;

  const salesEssentialsOk =
    offerAssess.ok && landingAssess.ok && copyAssess.ok && checkoutOk && creativesOk && Boolean(artifacts.factory);

  if (!stepCompleted("sales_system") || !salesPackage || !salesEssentialsOk) {
    const gaps = [];
    if (!offerAssess.ok) gaps.push(offerAssess.reason);
    if (!landingAssess.ok) gaps.push(landingAssess.reason);
    if (!copyAssess.ok) gaps.push(copyAssess.reason);
    if (!checkoutOk) gaps.push("Checkout inválido ou ausente");
    if (!creativesOk) gaps.push("Criativos ausentes");
    stages.push(
      fail(
        "sales_system",
        `assets_ready=${Boolean(salesAssetsReady)}, commercial=${commercialScore}`,
        meta.last_error ?? (gaps.join("; ") || "Sales Package incompleto"),
        commercialScore
      )
    );
  } else {
    stages.push(
      pass(
        "sales_system",
        commercialScore != null ? Math.round(commercialScore) : null,
        `Pacote comercial completo — produto, oferta, landing, copy, criativos, checkout`
      )
    );
  }

  // 7. Commercial Score (gate explícito)
  if (commercialScore == null || commercialScore < 90) {
    stages.push(
      fail(
        "commercial_score",
        `score=${commercialScore}`,
        `Commercial Score abaixo de 90`,
        commercialScore
      )
    );
  } else {
    stages.push(pass("commercial_score", Math.round(commercialScore), "Commercial Score ≥ 90"));
  }

  // 8. Investment Committee
  const investmentScore = meta.investment_score ?? null;
  if (!stepCompleted("investment_committee") || meta.investment_approved !== true) {
    stages.push(
      fail(
        "investment_committee",
        `approved=${meta.investment_approved}, score=${investmentScore}`,
        meta.investment_recommendation ?? meta.last_error ?? "Investment Committee reprovou",
        investmentScore
      )
    );
  } else {
    stages.push(
      pass(
        "investment_committee",
        investmentScore != null ? Math.round(investmentScore) : null,
        meta.investment_recommendation ?? "Investment Committee aprovou"
      )
    );
  }

  // 9. Ready To Sell
  const readyToSell =
    meta.ready_to_sell === true ||
    salesPackage?.readyToSell === true ||
    (salesPackage
      ? evaluateReadyToSell({ meta, salesPackage })
      : false);

  if (!readyToSell) {
    stages.push(
      fail(
        "ready_to_sell",
        `meta.ready_to_sell=${meta.ready_to_sell}, package=${salesPackage?.readyToSell}`,
        (salesPackage?.pendingItems ?? meta.sales_pending_items ?? []).join("; ") || "Pacote não está Ready To Sell",
        commercialScore
      )
    );
  } else {
    stages.push(pass("ready_to_sell", commercialScore != null ? Math.round(commercialScore) : null, "Ready To Sell = true"));
  }

  // 10. Pendências
  const pendencies = [...new Set([...(mission?.pendencies ?? []), ...(salesPackage?.pendingItems ?? [])])];
  if (pendencies.length > 0) {
    stages.push(
      fail(
        "pendencias",
        pendencies.join(" | "),
        `${pendencies.length} pendência(s) ativa(s)`,
        null
      )
    );
  } else {
    stages.push(pass("pendencias", null, "Nenhuma pendência registrada"));
  }

  // 11. Publicabilidade real
  const publishCert = evaluateReadyToSellCertification({
    checkout_url: meta.checkout_url ?? null,
    funnel_url: meta.funnel_url ?? null,
    landing_url: meta.landing_url ?? null,
    landing_published: meta.landing_published ?? false,
    campaign_id: flowRow?.campaign_id ?? meta.campaign_id ?? null,
    campaign_prepared: Boolean(flowRow?.campaign_id ?? meta.campaign_id),
    excellence_score: meta.commercial_excellence_score ?? meta.excellence_score ?? commercialScore,
    product_quality_score: productQuality?.score ?? meta.product_quality_score ?? null,
    landing_quality_score: artifacts.landing?.quality_score ?? commercialScore,
    creative_score: creativesOk ? 85 : 0,
    campaign_score: flowRow?.campaign_id ? 85 : 0,
    explicit_publish_approval: meta.explicit_publish_approval ?? false,
  });

  const publishable =
    publishCert.ready &&
    productAssess.ok &&
    offerAssess.ok &&
    landingAssess.ok &&
    copyAssess.ok &&
    checkoutOk &&
    creativesOk &&
    (productQuality?.score ?? meta.product_quality_score ?? 0) >= 85;

  if (!publishable) {
    stages.push(
      fail(
        "publicabilidade",
        `gaps=${publishCert.gaps.join("; ") || "nenhum"}`,
        publishCert.gaps.join("; ") || "Pacote não é publicável sem intervenção manual",
        productQuality?.score ?? null
      )
    );
  } else {
    stages.push(
      pass(
        "publicabilidade",
        productQuality?.score != null ? Math.round(productQuality.score) : null,
        "Produto e pacote comercial são publicáveis"
      )
    );
  }

  // Mission Review gate
  const atReview =
    mission?.current_step === "mission_review" ||
    mission?.is_ready_for_review ||
    Boolean(mission?.blocked_reason);

  if (!atReview && mission?.status === "failed") {
    stages.push(
      fail(
        "mission_review",
        `status=${mission?.status}, step=${mission?.current_step}`,
        mission?.last_error ?? meta.last_error ?? apiError ?? "Missão falhou antes da revisão",
        null
      )
    );
  } else if (!atReview) {
    stages.push(
      fail(
        "mission_review",
        `status=${mission?.status}, step=${mission?.current_step}`,
        `Missão não chegou ao gate de revisão. completed=${[...completed].join(",")}`,
        null
      )
    );
  } else {
    stages.push(
      pass(
        "mission_review",
        investmentScore != null ? Math.round(investmentScore) : null,
        mission?.blocked_reason ?? "Missão bloqueada em Mission Review para aprovação humana"
      )
    );
  }

  return stages;
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const openai = process.env.OPENAI_API_KEY?.trim();

const report = {
  certification: "Aura Core Runtime",
  timestamp: new Date().toISOString(),
  mission_intent: TEST_MISSION,
  environment: {
    openai_configured: Boolean(openai),
    supabase_configured: Boolean(url && anon),
  },
  pipeline: PIPELINE_STEPS,
  stages: [],
  runtime: null,
  fatal: null,
  result: "FAIL",
};

if (!url || !anon) {
  report.fatal = "Faltam NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY";
  console.log(JSON.stringify(report, null, 2));
  console.log("\nFAIL");
  process.exit(1);
}

const supabase = createClient(url, anon);

try {
  const session = await ensureAuth(supabase, url);
  const userId = session.user.id;
  const ctx = { user: session.user, supabase, userId };
  const restore = installAuditContext(ctx);

  let missionPayload;
  try {
    const { startMission } = await import("../lib/supabase/services/master-flow.service.ts");
    missionPayload = await startMission({ raw: TEST_MISSION });
  } finally {
    restore();
  }

  report.runtime = {
    api_error: missionPayload?.error ?? null,
    mission_status: missionPayload?.mission?.status ?? null,
    current_step: missionPayload?.mission?.current_step ?? null,
    completed_steps: missionPayload?.mission?.completed_steps ?? [],
    failed_step: missionPayload?.mission?.failed_step ?? null,
    blocked_reason: missionPayload?.mission?.blocked_reason ?? null,
    is_ready_for_review: missionPayload?.mission?.is_ready_for_review ?? false,
  };

  if (!missionPayload?.mission) {
    report.fatal = missionPayload?.error ?? "Missão não retornada pelo Master Flow";
    report.stages.push(
      fail("master_flow", "startMission sem retorno", report.fatal, null)
    );
  } else {
    const mission = missionPayload.mission;
    const flowRow = await fetchRow(supabase, "master_flows", mission.flow_id, userId);
    const meta = flowRow ? readMasterFlowMetadata(flowRow) : {};

    const factory = meta.factory_id
      ? await fetchRow(supabase, "product_factory", meta.factory_id, userId)
      : null;
    const offer = meta.offer_id ? await fetchRow(supabase, "offers", meta.offer_id, userId) : null;
    const landing = meta.landing_id
      ? await fetchRow(supabase, "landing_pages", meta.landing_id, userId)
      : null;
    const copy = meta.copylab_id
      ? await fetchRow(supabase, "creator_copylab", meta.copylab_id, userId)
      : null;

    const { data: generatedCreatives } = meta.operation_id
      ? await supabase
          .from("creative_generated_assets")
          .select("id")
          .eq("user_id", userId)
          .eq("operation_id", meta.operation_id)
      : { data: [] };

    const productQuality = factory ? computeProductQualityScore(factory) : null;

    const artifacts = {
      factory,
      offer,
      landing,
      copy,
      generatedCreativesCount: generatedCreatives?.length ?? 0,
    };

    report.stages = buildStageReport({
      mission,
      meta,
      flowRow,
      artifacts,
      productQuality,
      apiError: missionPayload.error,
    });

    // Erro da API não pode ser mascarado como sucesso
    if (missionPayload.error && mission.status !== "failed") {
      report.stages.push(
        fail(
          "erro_mascarado",
          `api_error=${missionPayload.error}`,
          "API retornou erro sem marcar missão como failed",
          null
        )
      );
    }

    const pipelineComplete = PIPELINE_STEPS.slice(0, -1).every((step) =>
      (mission.completed_steps ?? []).includes(step)
    );

    report.summary = {
      pipeline_complete: pipelineComplete,
      steps_expected: PIPELINE_STEPS.length,
      steps_in_master_flow: MASTER_FLOW_STEPS.length,
      pass: report.stages.filter((s) => s.status === "PASS").length,
      fail: report.stages.filter((s) => s.status === "FAIL").length,
      mission_status: mission.status,
      current_step: mission.current_step,
      commercial_score: meta.commercial_score ?? meta.sales_package?.commercialScore ?? null,
      investment_score: meta.investment_score ?? null,
      investment_approved: meta.investment_approved ?? false,
      ready_to_sell: meta.ready_to_sell ?? meta.sales_package?.readyToSell ?? false,
      pendencies: mission.pendencies ?? [],
    };

    const allPass = report.stages.every((stage) => stage.status === "PASS");
    report.result = allPass ? "PASS" : "FAIL";
  }
} catch (err) {
  report.fatal = err instanceof Error ? err.message : String(err);
  report.stack = err instanceof Error ? err.stack : null;
  report.stages.push(fail("runtime", "exceção não tratada", report.fatal, null));
  report.result = "FAIL";
}

console.log(JSON.stringify(report, null, 2));
console.log(`\n${report.result}`);

if (report.result !== "PASS" || report.fatal) {
  process.exit(1);
}
