import assert from "node:assert/strict";
import test from "node:test";
import {
  orchestrationMatchesExplicitArtifacts,
  resolveOrchestratorArtifacts,
  validateOrchestratorExplicitArtifacts,
} from "./campaign-orchestrator";
import type {
  CreatorAdsCampaign,
  CreatorAsset,
  CreatorCopylab,
  CreatorLanding,
  CreatorResearch,
} from "@/types/database";

const productId = "prod-1";

function copy(id: string, product = productId): CreatorCopylab {
  return {
    id,
    user_id: "u1",
    product_id: product,
    nome: null,
    avatar: null,
    problema: null,
    solucao: null,
    promessa: null,
    diferencial: null,
    preco: null,
    headline: "Headline",
    subheadline: null,
    big_idea: null,
    mecanismo_unico: null,
    bullets: [],
    garantia: null,
    bonus: null,
    cta: null,
    pagina_vendas: null,
    estrutura_vsl: null,
    storytelling: null,
    email_lancamento: null,
    whatsapp_venda: null,
    instagram_post: null,
    facebook_ad: null,
    google_ad: null,
    created_at: "",
    updated_at: "",
  };
}

function asset(id: string, product = productId): CreatorAsset {
  return {
    id,
    user_id: "u1",
    product_id: product,
    copylab_id: null,
    nome: "Asset",
    avatar: null,
    problema: null,
    solucao: null,
    promessa: null,
    diferencial: null,
    preco: null,
    criativo_facebook: null,
    criativo_instagram: null,
    capa_ebook: null,
    thumbnail_youtube: null,
    mockup_produto: null,
    roteiro_reels: null,
    roteiro_shorts: null,
    roteiro_tiktok: null,
    vsl: null,
    carrossel_instagram: [],
    stories: [],
    legendas: null,
    cta: null,
    created_at: "",
    updated_at: "",
  };
}

function landing(id: string, product = productId): CreatorLanding {
  return {
    id,
    user_id: "u1",
    product_id: product,
    copylab_id: null,
    target_country: "BR",
    target_language: "pt-BR",
    currency: "BRL",
    modelo: "pagina_simples",
    nome: null,
    avatar: null,
    problema: null,
    solucao: null,
    promessa: null,
    diferencial: null,
    preco: null,
    hero_section: null,
    headline: "Landing",
    subheadline: null,
    beneficios: [],
    section_problema: null,
    section_solucao: null,
    depoimentos: [],
    garantia: null,
    bonus: null,
    faq: [],
    cta: null,
    rodape: null,
    created_at: "",
    updated_at: "",
  };
}

test("resolveOrchestratorArtifacts uses explicit ids before product_id match", () => {
  const copyA = copy("copy-a");
  const copyB = copy("copy-b");
  const assetA = asset("asset-a");
  const assetB = asset("asset-b");
  const landingA = landing("landing-a");
  const landingB = landing("landing-b");

  const { linked, error } = resolveOrchestratorArtifacts({
    productId,
    researchRecords: [] as CreatorResearch[],
    copyRecords: [copyA, copyB],
    assets: [assetA, assetB],
    landings: [landingA, landingB],
    adsCampaigns: [] as CreatorAdsCampaign[],
    explicit: {
      copylab_id: "copy-b",
      asset_id: "asset-b",
      landing_id: "landing-b",
    },
  });

  assert.equal(error, null);
  assert.equal(linked.copylab_id, "copy-b");
  assert.equal(linked.asset_id, "asset-b");
  assert.equal(linked.landing_id, "landing-b");
});

test("resolveOrchestratorArtifacts returns error when explicit id is missing", () => {
  const { error } = resolveOrchestratorArtifacts({
    productId,
    researchRecords: [] as CreatorResearch[],
    copyRecords: [copy("copy-a")],
    assets: [asset("asset-a")],
    landings: [landing("landing-a")],
    adsCampaigns: [] as CreatorAdsCampaign[],
    explicit: {
      copylab_id: "copy-missing",
      asset_id: "asset-a",
      landing_id: "landing-a",
    },
  });

  assert.ok(error?.includes("Copy não encontrada"));
});

test("validateOrchestratorExplicitArtifacts requires artifacts when operation_id is set", () => {
  const error = validateOrchestratorExplicitArtifacts({
    product_id: productId,
    operation_id: "op-1",
    copylab_id: null,
    assets_id: "asset-a",
    landing_id: "landing-a",
  });

  assert.ok(error?.includes("Copy"));
});

test("orchestrationMatchesExplicitArtifacts validates linked artifacts", () => {
  assert.equal(
    orchestrationMatchesExplicitArtifacts(
      { copylab_id: "copy-a", asset_id: "asset-a", landing_id: "landing-a" },
      { copylab_id: "copy-a", asset_id: "asset-a", landing_id: "landing-a" }
    ),
    true
  );
  assert.equal(
    orchestrationMatchesExplicitArtifacts(
      { copylab_id: "copy-b", asset_id: "asset-a", landing_id: "landing-a" },
      { copylab_id: "copy-a", asset_id: "asset-a", landing_id: "landing-a" }
    ),
    false
  );
});
