import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProductFactory } from "@/types/database";
import type { MasterFlowMetadata } from "@/utils/master-flow";
import {
  PRODUCT_STRATEGY_MISSING_ERROR,
  applyBriefToIntake,
  buildProductBuildBrief,
  evaluateStrategyAdherence,
  requiresProductStrategy,
  resolveStrategyFactoryProfile,
} from "@/utils/product-build-brief";
import type { ProductStrategyRecommendation } from "@/lib/product-strategist/product-strategist-types";

const sampleStrategy: ProductStrategyRecommendation = {
  id: "B",
  label: "Estratégia B",
  strategyType: "kit_premium",
  strategyName: "Kit Premium",
  ticket: 97,
  ticketLabel: "R$ 97",
  estimatedRevenue: 18000,
  estimatedCost: 180,
  estimatedLaunchTime: 3,
  estimatedMargin: 99,
  estimatedROI: 100,
  scalabilityLabel: "Muito Alta",
  scores: {
    revenue: 88,
    execution: 92,
    scalability: 95,
    speed: 98,
    investment: 96,
    total: 93,
  },
  reason: "Lançamento rápido com alta margem.",
};

const cursoStrategy: ProductStrategyRecommendation = {
  ...sampleStrategy,
  id: "A",
  label: "Estratégia A",
  strategyType: "curso_online",
  strategyName: "Curso Online",
  ticket: 197,
  estimatedLaunchTime: 12,
  estimatedMargin: 95,
  reason: "Transformação completa com módulos.",
};

const comunidadeStrategy: ProductStrategyRecommendation = {
  ...sampleStrategy,
  id: "C",
  label: "Estratégia C",
  strategyType: "comunidade",
  strategyName: "Comunidade",
  ticket: 49,
  estimatedLaunchTime: 8,
  reason: "Recorrência e LTV.",
  ltvMonths: 12,
};

function makeMeta(overrides: Partial<MasterFlowMetadata> = {}): MasterFlowMetadata {
  return {
    user_intent: "Quero ganhar R$20.000 por mês com Excel",
    niche: "Excel",
    avatar: "Analista administrativo",
    validation_approved: true,
    validation_score: 88,
    opportunity_engine_score: 87,
    selected_strategy: sampleStrategy,
    ...overrides,
  };
}

function makeFactory(
  overrides: Partial<ProductFactory> & { product_type?: ProductFactory["product_type"] }
): ProductFactory {
  return {
    id: "factory-1",
    user_id: "user-1",
    product_id: "prod-1",
    copylab_id: null,
    research_id: null,
    product_type: overrides.product_type ?? "checklist",
    titulo: overrides.titulo ?? "Kit Premium — Excel",
    subtitulo: null,
    promessa: "Aplicação imediata",
    avatar: "Analista",
    publico: "Analista",
    objetivo: "Produtividade",
    problema: "Planilhas",
    solucao: "Kit",
    capitulos: overrides.capitulos ?? Array.from({ length: 8 }, (_, i) => ({
      titulo: `Seção ${i + 1}`,
      resumo: "Resumo",
      conteudo: "Conteúdo prático",
    })),
    conteudo:
      overrides.conteudo ??
      ({
        introducao: "Kit prático",
        metodologia: "Passo a passo",
      } as ProductFactory["conteudo"]),
    exercicios: overrides.exercicios ?? [],
    bonus: overrides.bonus ?? "Templates extras",
    checklist: [],
    conclusao: "Conclusão",
    design: {},
    status: "content_ready",
    current_version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as ProductFactory;
}

describe("product build brief", () => {
  it("blocks factory path when selected_strategy is absent", () => {
    assert.equal(requiresProductStrategy(makeMeta({ selected_strategy: null })), true);
    assert.equal(PRODUCT_STRATEGY_MISSING_ERROR.includes("Product Strategy ausente"), true);
  });

  it("builds ProductBuildBrief with all required fields", () => {
    const brief = buildProductBuildBrief({ meta: makeMeta() });

    assert.ok(brief);
    assert.equal(brief!.selected_strategy_type, "kit_premium");
    assert.equal(brief!.selected_strategy_name, "Kit Premium");
    assert.equal(brief!.ticket, 97);
    assert.equal(brief!.estimated_launch_time, 3);
    assert.equal(brief!.margin, 99);
    assert.equal(brief!.validation_score, 88);
    assert.equal(brief!.strategist_score, 93);
    assert.ok(brief!.objective.length > 0);
    assert.ok(brief!.reason.length > 0);
  });

  it("maps Kit Premium to checklist — not course", () => {
    const brief = buildProductBuildBrief({
      meta: makeMeta({ selected_strategy: sampleStrategy }),
    })!;

    const profile = resolveStrategyFactoryProfile(brief);
    assert.equal(profile.product_type, "checklist");
    assert.match(profile.modules_hint, /NÃO gerar curso/i);

    const intake = applyBriefToIntake(
      { titulo: "", promessa: "", avatar: "", problema: "", solucao: "" },
      brief,
      profile
    );
    assert.equal(intake.product_type, "checklist");
    assert.equal(intake.build_brief?.selected_strategy_type, "kit_premium");
  });

  it("maps Curso Online to mini_curso with modules", () => {
    const brief = buildProductBuildBrief({
      meta: makeMeta({ selected_strategy: cursoStrategy }),
    })!;

    const profile = resolveStrategyFactoryProfile(brief);
    assert.equal(profile.product_type, "mini_curso");
    assert.match(profile.modules_hint, /módulos/i);
  });

  it("maps Comunidade to recurring monthly structure", () => {
    const brief = buildProductBuildBrief({
      meta: makeMeta({ selected_strategy: comunidadeStrategy }),
    })!;

    const profile = resolveStrategyFactoryProfile(brief);
    assert.equal(profile.product_type, "plano_30_dias");
    assert.match(profile.format, /recorrente/i);
  });

  it("flags Kit Premium when factory generates course structure", () => {
    const brief = buildProductBuildBrief({ meta: makeMeta() })!;
    const adherence = evaluateStrategyAdherence(
      brief,
      makeFactory({
        product_type: "mini_curso",
        titulo: "Curso Completo de Excel",
        capitulos: Array.from({ length: 6 }, (_, i) => ({
          titulo: `Módulo ${i + 1}`,
          resumo: "Aula",
          conteudo: "Conteúdo da aula",
        })),
      })
    );

    assert.equal(adherence.aligned, false);
    assert.ok(
      adherence.pendencies.some((p) => p.includes("Kit Premium não deve gerar curso"))
    );
  });

  it("approves Curso Online with modular structure", () => {
    const brief = buildProductBuildBrief({
      meta: makeMeta({ selected_strategy: cursoStrategy }),
    })!;

    const adherence = evaluateStrategyAdherence(
      brief,
      makeFactory({
        product_type: "mini_curso",
        titulo: "Curso Online — Excel",
        capitulos: Array.from({ length: 5 }, (_, i) => ({
          titulo: `Módulo ${i + 1}`,
          resumo: "Objetivo da aula",
          conteudo: "Conteúdo da aula",
        })),
      })
    );

    assert.ok(adherence.score >= 75);
    assert.equal(adherence.aligned, true);
  });

  it("flags Comunidade without recurrence signals", () => {
    const brief = buildProductBuildBrief({
      meta: makeMeta({ selected_strategy: comunidadeStrategy }),
    })!;

    const adherence = evaluateStrategyAdherence(
      brief,
      makeFactory({
        product_type: "plano_30_dias",
        conteudo: { introducao: "Guia prático", metodologia: "Passo a passo" },
        capitulos: Array.from({ length: 10 }, (_, i) => ({
          titulo: `Dia ${i + 1}`,
          resumo: "Foco",
          conteudo: "Ação",
        })),
      })
    );

    assert.ok(
      adherence.pendencies.some((p) => p.includes("recorrente") || p.includes("Comunidade"))
    );
  });

  it("saves brief fields ready for mission metadata", () => {
    const brief = buildProductBuildBrief({ meta: makeMeta() })!;
    const metadata: MasterFlowMetadata = {
      product_build_brief: brief,
      selected_strategy: sampleStrategy,
    };

    assert.ok(metadata.product_build_brief);
    assert.equal(metadata.product_build_brief!.selected_strategy_type, "kit_premium");
    assert.equal(metadata.product_build_brief!.ticket, 97);
  });
});
