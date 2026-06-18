import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProductFactory } from "@/types/database";
import {
  computeProductQualityScore,
  PRODUCT_MANUAL_REVIEW_MESSAGE,
  PRODUCT_QUALITY_MIN_FAQS,
  PRODUCT_QUALITY_MIN_SCORE,
} from "./product-factory-pro";

function buildEliteMockFactory(overrides?: {
  faqs?: { pergunta: string; resposta: string }[];
  omitFaqs?: boolean;
}): ProductFactory {
  const faqs =
    overrides?.omitFaqs === true
      ? []
      : (overrides?.faqs ??
        Array.from({ length: 5 }, (_, i) => ({
          pergunta: `Pergunta frequente ${i + 1}?`,
          resposta: `Resposta detalhada ${"palavra ".repeat(25)}${i + 1}.`,
        })));

  return {
    id: "test-factory",
    user_id: "test-user",
    product_id: null,
    copylab_id: null,
    research_id: null,
    product_type: "ebook",
    titulo: "Weight Loss Blueprint",
    subtitulo: "Complete transformation system",
    promessa: "Lose weight sustainably with science-backed habits",
    avatar: "Adults seeking healthy weight",
    publico: "Adults 25-45",
    objetivo: "Sustainable weight management",
    problema: "Struggling with weight",
    solucao: "Structured habit system",
    capitulos: Array.from({ length: 6 }, (_, i) => ({
      titulo: `Chapter ${i + 1}`,
      resumo: "Summary",
      conteudo: "word ".repeat(420),
      explicacao: "detail ".repeat(150),
      exemplo: "example ".repeat(60),
      aplicacao_pratica: "apply ".repeat(60),
      exercicio: "exercise",
      checklist: "check",
    })),
    exercicios: Array.from({ length: 6 }, (_, i) => ({
      titulo: `Ex ${i}`,
      instrucao: "do",
      reflexao: "reflect",
    })),
    checklist: Array.from({ length: 8 }, (_, i) => ({ item: `Item ${i}`, descricao: "desc" })),
    bonus: "bonus ".repeat(220),
    conclusao: "conclusion ".repeat(80),
    design: {
      template_id: "fitness_modern",
      capa: "Premium cover",
      paleta: ["#0F766E", "#134E4A", "#F97316", "#ECFDF5"],
      estilo_visual: "modern fitness",
      paginas_internas: "clean layout",
      mockup_textual: "",
      tipografia: "",
      moodboard: "",
    },
    conteudo: {
      introducao: "intro ".repeat(200),
      metodologia: "method ".repeat(150),
      sumario: ["Ch1", "Ch2", "Ch3", "Ch4", "Ch5", "Ch6"],
      plano_acao: Array.from({ length: 6 }, (_, i) => ({
        item: `Step ${i}`,
        prazo: "7d",
        acao: "act",
      })),
      promessa_transformacao: "Transform your body",
      proximos_passos: "CTA final — start now",
      faqs,
      pro_version: true,
    },
    status: "design_ready",
    current_version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as ProductFactory;
}

describe("product-factory-pro — quality score", () => {
  it("produto vazio reprova", () => {
    const empty = {
      titulo: "Test",
      promessa: "p",
      capitulos: [],
      exercicios: [],
      checklist: [],
      design: {},
      conteudo: {},
      bonus: null,
      conclusao: null,
      subtitulo: null,
      problema: null,
    } as unknown as ProductFactory;

    const quality = computeProductQualityScore(empty);
    assert.ok(quality.score < PRODUCT_QUALITY_MIN_SCORE);
    assert.equal(quality.readyToSell, false);
    assert.ok(quality.issues.length > 0);
  });

  it("produto com compliance fail reprova", () => {
    const factory = buildEliteMockFactory();
    const quality = computeProductQualityScore(factory, {
      status: "fail",
      risk_score: 90,
      forbidden_claims: [],
    } as never);

    assert.equal(quality.readyToSell, false);
    assert.ok(quality.score < PRODUCT_QUALITY_MIN_SCORE || !quality.readyToSell);
  });

  it("produto elite com volume, exercícios, checklist e FAQs aprova", () => {
    const factory = buildEliteMockFactory();
    const quality = computeProductQualityScore(factory, {
      status: "pass",
      risk_score: 10,
      forbidden_claims: [],
    } as never);

    assert.ok(quality.score >= PRODUCT_QUALITY_MIN_SCORE, `score=${quality.score}`);
    assert.equal(quality.readyToSell, true);
    assert.ok(quality.estimatedPages >= 20);
  });

  it("produto sem FAQ perde score", () => {
    const withFaqs = computeProductQualityScore(
      buildEliteMockFactory(),
      { status: "pass", risk_score: 10, forbidden_claims: [] } as never
    );
    const withoutFaqs = computeProductQualityScore(
      buildEliteMockFactory({ omitFaqs: true }),
      { status: "pass", risk_score: 10, forbidden_claims: [] } as never
    );

    assert.ok(withFaqs.score > withoutFaqs.score);
    assert.ok(
      withoutFaqs.issues.some((issue) => issue.includes(String(PRODUCT_QUALITY_MIN_FAQS)))
    );
    assert.equal(withoutFaqs.readyToSell, false);
  });

  it("produto abaixo de 85 não fica readyToSell", () => {
    const factory = buildEliteMockFactory({ omitFaqs: true });
    const quality = computeProductQualityScore(factory, {
      status: "pass",
      risk_score: 10,
      forbidden_claims: [],
    } as never);

    assert.ok(quality.score < PRODUCT_QUALITY_MIN_SCORE || !quality.readyToSell);
    assert.equal(quality.readyToSell, false);
  });

  it("exporta mensagem de revisão manual", () => {
    assert.equal(PRODUCT_MANUAL_REVIEW_MESSAGE, "Produto precisa de revisão manual.");
  });
});
