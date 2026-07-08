import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAifCeoKnowledgeBlock,
  buildAifConfidence,
  createAifId,
  inferCategoryFromNiche,
  normalizeAifKey,
  type AifStructuredKnowledge,
} from "./aif";
import { runAifKnowledgeNormalizer } from "@/lib/aif/knowledge-normalizer";
import { runAifKnowledgeValidator } from "@/lib/aif/knowledge-validator";
import { buildAifKnowledgeGraph } from "@/lib/aif/knowledge-graph";
import {
  ensureAifOperationalDecisionRules,
  isOperationalDecisionRule,
} from "@/lib/aif/decision-rules";

const sampleDraft = {
  frameworks: [
    {
      id: createAifId("framework", "Oferta Irresistível"),
      type: "framework" as const,
      name: "Oferta Irresistível",
      category: "offer_creation" as const,
      summary: "Estrutura de oferta com garantia e bônus",
      principles: ["Stack de valor", "Garantia forte"],
      whenToUse: "Ao criar ou revisar oferta",
      examples: ["Bônus de implementação"],
      confidence: buildAifConfidence(80),
    },
  ],
  checklists: [
    {
      id: createAifId("checklist", "Checklist de Landing"),
      type: "checklist" as const,
      name: "Checklist de Landing",
      category: "landing_page" as const,
      summary: "Validar landing antes de subir tráfego",
      items: ["Headline clara", "CTA visível", "Prova social"],
      passCriteria: "Todos os itens críticos ok",
      checklistType: "validation" as const,
      confidence: buildAifConfidence(75),
    },
  ],
  decisionRules: [
    {
      id: createAifId("decision-rule", "Escalar criativos"),
      type: "decision_rule" as const,
      name: "Escalar criativos vencedores",
      category: "paid_traffic" as const,
      summary: "Escalar apenas após validação",
      rule: "Escalar budget somente quando CPA estiver 20% abaixo da meta por 3 dias",
      whenToApply: "Campanha com dados estáveis",
      whenNotToApply: "Menos de 50 conversões na janela",
      priority: 70,
      frameworkRef: "Oferta Irresistível",
      confidence: buildAifConfidence(85),
    },
  ],
  kpis: [],
  cases: [],
  principles: [],
  mentalModels: [],
  antiPatterns: [],
  concepts: [],
};

test("normalizeAifKey removes accents and normalizes spacing", () => {
  assert.equal(normalizeAifKey("Oferta  Irresistível"), "oferta irresistivel");
});

test("inferCategoryFromNiche maps keywords", () => {
  assert.equal(inferCategoryFromNiche("funil perpétuo"), "funnel_strategy");
  assert.equal(inferCategoryFromNiche("copy de vendas"), "copywriting");
});

test("runAifKnowledgeNormalizer trims entity fields", () => {
  const normalized = runAifKnowledgeNormalizer(sampleDraft, "oferta");
  assert.equal(normalized.frameworks[0].name, "Oferta Irresistível");
  assert.ok(normalized.frameworks[0].whenToUse.length > 10);
});

test("runAifKnowledgeValidator deduplicates by name", () => {
  const duplicate = {
    ...sampleDraft,
    frameworks: [
      ...sampleDraft.frameworks,
      { ...sampleDraft.frameworks[0], id: "framework-dup" },
    ],
  };
  const { draft, report } = runAifKnowledgeValidator(duplicate);
  assert.equal(draft.frameworks.length, 1);
  assert.ok(report.deduplicatedCount >= 1);
});

test("buildAifKnowledgeGraph links funnel chain", () => {
  const graph = buildAifKnowledgeGraph(sampleDraft);
  assert.ok(graph.nodes.some((n) => n.id === "funnel-offer"));
  assert.ok(graph.nodes.some((n) => n.id === "funnel-conversion"));
  assert.ok(graph.edges.some((e) => e.from === "funnel-offer" && e.to === "funnel-landing"));
});

test("ensureAifOperationalDecisionRules generates framework rules", () => {
  const withRules = ensureAifOperationalDecisionRules({
    ...sampleDraft,
    decisionRules: [],
  });
  assert.ok(withRules.decisionRules.length >= 1);
  assert.ok(isOperationalDecisionRule(withRules.decisionRules[0]));
});

test("buildAifCeoKnowledgeBlock excludes raw course content", () => {
  const knowledge: AifStructuredKnowledge = {
    ...sampleDraft,
    graph: buildAifKnowledgeGraph(sampleDraft),
    validation: {
      passed: true,
      issues: [],
      deduplicatedCount: 0,
      averageConfidence: 80,
    },
  };
  const block = buildAifCeoKnowledgeBlock(knowledge);
  assert.match(block, /Conhecimento Estruturado/);
  assert.match(block, /Oferta Irresistível/);
  assert.match(block, /nunca conteúdo bruto/);
  assert.doesNotMatch(block, /transcrição completa do módulo/i);
});
