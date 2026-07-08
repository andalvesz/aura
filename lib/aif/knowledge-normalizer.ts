import type { ExpertBrainCategory } from "@/types/database";
import {
  buildAifConfidence,
  createAifId,
  normalizeAifKey,
  type AifAntiPattern,
  type AifCase,
  type AifChecklist,
  type AifConcept,
  type AifDecisionRule,
  type AifFramework,
  type AifKpi,
  type AifMentalModel,
  type AifPrinciple,
  type AifStructuredKnowledge,
} from "@/utils/aif";
import type { AifExtractionDraft } from "./knowledge-extractor";

function trimEntity<T extends { name: string; summary: string }>(entity: T): T {
  return {
    ...entity,
    name: entity.name.trim().slice(0, 160),
    summary: entity.summary.trim().slice(0, 500),
  };
}

function normalizeFramework(fw: AifFramework, niche?: string | null): AifFramework {
  return trimEntity({
    ...fw,
    id: fw.id || createAifId("framework", fw.name),
    principles: (fw.principles ?? []).map((p) => p.trim()).filter(Boolean).slice(0, 8),
    whenToUse: fw.whenToUse?.trim() || "Quando o contexto exigir este método.",
    examples: (fw.examples ?? []).map((e) => e.trim()).filter(Boolean).slice(0, 5),
    category: fw.category ?? inferFallbackCategory(niche),
    confidence: fw.confidence ?? buildAifConfidence(70),
  });
}

function inferFallbackCategory(niche?: string | null): ExpertBrainCategory {
  return niche?.toLowerCase().includes("funil") ? "funnel_strategy" : "copywriting";
}

function normalizeDecisionRule(rule: AifDecisionRule, niche?: string | null): AifDecisionRule {
  return trimEntity({
    ...rule,
    id: rule.id || createAifId("decision-rule", rule.name),
    rule: rule.rule.trim(),
    whenToApply: rule.whenToApply?.trim() || "Quando os pré-requisitos do contexto forem atendidos.",
    whenNotToApply: rule.whenNotToApply?.trim() || "Quando houver risco operacional ou dados insuficientes.",
    priority: Math.max(1, Math.min(100, rule.priority ?? 50)),
    category: rule.category ?? inferFallbackCategory(niche),
    confidence: rule.confidence ?? buildAifConfidence(70),
  });
}

function normalizeChecklist(cl: AifChecklist, niche?: string | null): AifChecklist {
  return trimEntity({
    ...cl,
    id: cl.id || createAifId("checklist", cl.name),
    items: (cl.items ?? []).map((i) => i.trim()).filter(Boolean).slice(0, 20),
    passCriteria: cl.passCriteria?.trim() || "Todos os itens críticos verificados.",
    category: cl.category ?? inferFallbackCategory(niche),
    confidence: cl.confidence ?? buildAifConfidence(70),
  });
}

function normalizeKpi(kpi: AifKpi, niche?: string | null): AifKpi {
  return trimEntity({
    ...kpi,
    id: kpi.id || createAifId("kpi", kpi.name),
    metric: kpi.metric.trim(),
    target: kpi.target.trim(),
    measurement: kpi.measurement.trim(),
    frequency: kpi.frequency?.trim() || "semanal",
    category: kpi.category ?? inferFallbackCategory(niche),
    confidence: kpi.confidence ?? buildAifConfidence(60),
  });
}

function normalizeCase(c: AifCase, niche?: string | null): AifCase {
  return trimEntity({
    ...c,
    id: c.id || createAifId("case", c.name),
    context: c.context.trim(),
    actions: (c.actions ?? []).map((a) => a.trim()).filter(Boolean),
    outcome: c.outcome.trim(),
    lessons: (c.lessons ?? []).map((l) => l.trim()).filter(Boolean),
    category: c.category ?? inferFallbackCategory(niche),
    confidence: c.confidence ?? buildAifConfidence(65),
  });
}

function normalizePrinciple(p: AifPrinciple, niche?: string | null): AifPrinciple {
  return trimEntity({
    ...p,
    id: p.id || createAifId("principle", p.name),
    statement: p.statement.trim(),
    rationale: p.rationale.trim(),
    category: p.category ?? inferFallbackCategory(niche),
    confidence: p.confidence ?? buildAifConfidence(65),
  });
}

function normalizeMentalModel(m: AifMentalModel, niche?: string | null): AifMentalModel {
  return trimEntity({
    ...m,
    id: m.id || createAifId("mental-model", m.name),
    model: m.model.trim(),
    application: m.application.trim(),
    pitfalls: (m.pitfalls ?? []).map((x) => x.trim()).filter(Boolean),
    category: m.category ?? inferFallbackCategory(niche),
    confidence: m.confidence ?? buildAifConfidence(60),
  });
}

function normalizeAntiPattern(ap: AifAntiPattern, niche?: string | null): AifAntiPattern {
  return trimEntity({
    ...ap,
    id: ap.id || createAifId("anti-pattern", ap.name),
    warningSigns: (ap.warningSigns ?? []).map((w) => w.trim()).filter(Boolean),
    consequences: (ap.consequences ?? []).map((c) => c.trim()).filter(Boolean),
    prevention: (ap.prevention ?? []).map((p) => p.trim()).filter(Boolean),
    category: ap.category ?? inferFallbackCategory(niche),
    confidence: ap.confidence ?? buildAifConfidence(68),
  });
}

function normalizeConcept(c: AifConcept, niche?: string | null): AifConcept {
  return trimEntity({
    ...c,
    id: c.id || createAifId("concept", c.name),
    definition: c.definition.trim(),
    relatedConcepts: (c.relatedConcepts ?? []).map((r) => r.trim()).filter(Boolean),
    category: c.category ?? inferFallbackCategory(niche),
    confidence: c.confidence ?? buildAifConfidence(55),
  });
}

export function runAifKnowledgeNormalizer(
  draft: AifExtractionDraft,
  niche?: string | null
): AifExtractionDraft {
  return {
    frameworks: draft.frameworks.map((f) => normalizeFramework(f, niche)),
    checklists: draft.checklists.map((c) => normalizeChecklist(c, niche)),
    decisionRules: draft.decisionRules.map((r) => normalizeDecisionRule(r, niche)),
    kpis: draft.kpis.map((k) => normalizeKpi(k, niche)),
    cases: draft.cases.map((c) => normalizeCase(c, niche)),
    principles: draft.principles.map((p) => normalizePrinciple(p, niche)),
    mentalModels: draft.mentalModels.map((m) => normalizeMentalModel(m, niche)),
    antiPatterns: draft.antiPatterns.map((a) => normalizeAntiPattern(a, niche)),
    concepts: draft.concepts.map((c) => normalizeConcept(c, niche)),
  };
}

export function structuredKnowledgeFingerprint(knowledge: AifStructuredKnowledge): string {
  const keys = [
    ...knowledge.frameworks.map((f) => normalizeAifKey(f.name)),
    ...knowledge.decisionRules.map((r) => normalizeAifKey(r.name)),
    ...knowledge.checklists.map((c) => normalizeAifKey(c.name)),
  ];
  return keys.sort().join("|");
}

export function mergeNormalizedKnowledge(
  base: AifExtractionDraft,
  incoming: AifExtractionDraft
): AifExtractionDraft {
  const seen = new Set<string>();
  const merge = <T extends { name: string }>(items: T[]): T[] =>
    items.filter((item) => {
      const key = normalizeAifKey(item.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return {
    frameworks: merge([...base.frameworks, ...incoming.frameworks]),
    checklists: merge([...base.checklists, ...incoming.checklists]),
    decisionRules: merge([...base.decisionRules, ...incoming.decisionRules]),
    kpis: merge([...base.kpis, ...incoming.kpis]),
    cases: merge([...base.cases, ...incoming.cases]),
    principles: merge([...base.principles, ...incoming.principles]),
    mentalModels: merge([...base.mentalModels, ...incoming.mentalModels]),
    antiPatterns: merge([...base.antiPatterns, ...incoming.antiPatterns]),
    concepts: merge([...base.concepts, ...incoming.concepts]),
  };
}
