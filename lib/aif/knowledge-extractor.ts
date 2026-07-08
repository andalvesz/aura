import {
  extractChecklists,
  extractDecisionRules,
  extractExpertPatterns,
  extractFailurePatterns,
  extractFrameworks,
  extractPlaybooks,
  extractSuccessPatterns,
} from "@/lib/supabase/services/expert-brain.service";
import type { ExpertBrainCategory } from "@/types/database";
import {
  buildAifConfidence,
  createAifId,
  inferCategoryFromNiche,
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
import { heuristicExtractFrameworks } from "@/utils/expert-brain";

export type AifExtractionInput = {
  rawText: string;
  title: string;
  author?: string | null;
  niche?: string | null;
};

export type AifExtractionDraft = {
  frameworks: AifFramework[];
  checklists: AifChecklist[];
  decisionRules: AifDecisionRule[];
  kpis: AifKpi[];
  cases: AifCase[];
  principles: AifPrinciple[];
  mentalModels: AifMentalModel[];
  antiPatterns: AifAntiPattern[];
  concepts: AifConcept[];
};

function defaultCategory(niche?: string | null): ExpertBrainCategory {
  return inferCategoryFromNiche(niche);
}

function heuristicExtractKpis(rawText: string, category: ExpertBrainCategory): AifKpi[] {
  const lines = rawText.split("\n").filter((l) => /kpi|métrica|metric|meta|taxa|%/i.test(l));
  return lines.slice(0, 6).map((line, i) => {
    const metric = line.replace(/^[-*•\d.]+\s*/, "").trim().slice(0, 120);
    return {
      id: createAifId("kpi", metric || `kpi-${i}`),
      type: "kpi" as const,
      name: metric.slice(0, 80) || `KPI ${i + 1}`,
      category,
      summary: metric,
      metric,
      target: "Definir meta com baseline",
      measurement: "Acompanhar no dashboard de performance",
      frequency: "semanal",
      confidence: buildAifConfidence(55, ["extraído heuristicamente"]),
    };
  });
}

function heuristicExtractPrinciples(
  frameworks: AifFramework[],
  category: ExpertBrainCategory
): AifPrinciple[] {
  const principles: AifPrinciple[] = [];
  for (const fw of frameworks) {
    for (const p of fw.principles) {
      principles.push({
        id: createAifId("principle", p),
        type: "principle",
        name: p.slice(0, 80),
        category: fw.category ?? category,
        summary: p,
        statement: p,
        rationale: `Derivado do framework ${fw.name}`,
        confidence: buildAifConfidence(70, ["princípio de framework"]),
        sourceRef: fw.id,
      });
    }
  }
  return principles.slice(0, 12);
}

function heuristicExtractMentalModels(rawText: string, category: ExpertBrainCategory): AifMentalModel[] {
  const headings = rawText.match(/^#{1,3}\s+.+$/gm) ?? [];
  return headings
    .filter((h) => /modelo|mental|framework|método|sistema/i.test(h))
    .slice(0, 5)
    .map((h) => {
      const name = h.replace(/^#+\s*/, "").trim();
      return {
        id: createAifId("mental-model", name),
        type: "mental_model" as const,
        name,
        category,
        summary: `Modelo mental: ${name}`,
        model: name,
        application: "Aplicar ao diagnosticar e priorizar decisões",
        pitfalls: ["Aplicar fora de contexto", "Confundir correlação com causalidade"],
        confidence: buildAifConfidence(60, ["extraído de heading"]),
      };
    });
}

function heuristicExtractConcepts(rawText: string, category: ExpertBrainCategory): AifConcept[] {
  const bullets = rawText.match(/^[-*•]\s+.+$/gm) ?? [];
  return bullets
    .slice(0, 8)
    .map((line, i) => {
      const definition = line.replace(/^[-*•]\s+/, "").trim();
      return {
        id: createAifId("concept", definition || `concept-${i}`),
        type: "concept" as const,
        name: definition.slice(0, 60) || `Conceito ${i + 1}`,
        category,
        summary: definition,
        definition,
        relatedConcepts: [],
        confidence: buildAifConfidence(50, ["bullet extraído"]),
      };
    });
}

export async function runAifKnowledgeExtractor(input: AifExtractionInput): Promise<AifExtractionDraft> {
  const category = defaultCategory(input.niche);
  const rawText = input.rawText.trim();

  const { frameworks: fwDrafts } = await extractFrameworks({
    rawText,
    title: input.title,
    niche: input.niche,
    author: input.author,
  });

  const fallbackFrameworks =
    fwDrafts.length > 0 ? fwDrafts : heuristicExtractFrameworks(rawText, input.niche);

  const frameworks: AifFramework[] = fallbackFrameworks.map((draft) => ({
    id: createAifId("framework", draft.name),
    type: "framework",
    name: draft.name,
    category: draft.category ?? category,
    summary: draft.description,
    principles: draft.principles ?? [],
    whenToUse: draft.when_to_use,
    examples: draft.examples ?? [],
    confidence: buildAifConfidence(75, ["extraído por IA/heurística"]),
  }));

  const { playbooks: _playbookDrafts } = await extractPlaybooks({ frameworks: fallbackFrameworks, rawText });
  void _playbookDrafts;

  const { patterns: patternDrafts } = await extractExpertPatterns({
    frameworks: fallbackFrameworks,
    sourceId: "aif-draft",
    rawText,
  });

  const { rules: ruleDrafts } = await extractDecisionRules({
    frameworks: fallbackFrameworks,
    sourceId: "aif-draft",
    rawText,
  });

  const decisionRules: AifDecisionRule[] = ruleDrafts.map((draft) => ({
    id: createAifId("decision-rule", draft.title),
    type: "decision_rule",
    name: draft.title,
    category: draft.category ?? category,
    summary: draft.rule,
    rule: draft.rule,
    whenToApply: draft.when_to_apply,
    whenNotToApply: draft.when_not_to_apply,
    priority: draft.priority ?? 50,
    frameworkRef: draft.framework_name,
    confidence: buildAifConfidence(draft.confidence_score ?? 70, ["regra de decisão extraída"]),
  }));

  const { checklists: checklistDrafts } = await extractChecklists({
    frameworks: fallbackFrameworks,
    rawText,
  });

  const checklists: AifChecklist[] = checklistDrafts.map((draft) => ({
    id: createAifId("checklist", draft.title),
    type: "checklist",
    name: draft.title,
    category,
    summary: draft.pass_criteria,
    items: draft.items ?? [],
    passCriteria: draft.pass_criteria,
    checklistType: draft.checklist_type ?? "operational",
    confidence: buildAifConfidence(72, ["checklist extraída"]),
  }));

  const { patterns: failureDrafts } = await extractFailurePatterns({
    frameworks: fallbackFrameworks,
    rawText,
  });

  const antiPatterns: AifAntiPattern[] = failureDrafts.map((draft) => ({
    id: createAifId("anti-pattern", draft.title),
    type: "anti_pattern",
    name: draft.title,
    category,
    summary: draft.description,
    warningSigns: draft.warning_signs ?? [],
    consequences: draft.consequences ?? [],
    prevention: draft.prevention_actions ?? [],
    confidence: buildAifConfidence(68, ["anti-pattern / failure pattern"]),
  }));

  const { patterns: successDrafts } = await extractSuccessPatterns({
    frameworks: fallbackFrameworks,
    rawText,
  });

  const cases: AifCase[] = successDrafts.map((draft) => ({
    id: createAifId("case", draft.title),
    type: "case",
    name: draft.title,
    category,
    summary: draft.description,
    context: draft.description,
    actions: draft.scaling_actions ?? [],
    outcome: "Resultado positivo replicável",
    lessons: draft.success_signals ?? [],
    confidence: buildAifConfidence(65, ["case derivado de success pattern"]),
  }));

  const kpis: AifKpi[] = [
    ...heuristicExtractKpis(rawText, category),
    ...patternDrafts
      .filter((p) => /kpi|métrica|metric/i.test(p.title))
      .map((p) => ({
        id: createAifId("kpi", p.title),
        type: "kpi" as const,
        name: p.title,
        category,
        summary: p.description,
        metric: p.title,
        target: "Definir com baseline histórico",
        measurement: p.description,
        frequency: "semanal",
        confidence: buildAifConfidence(p.confidence_score ?? 60, ["pattern tipo KPI"]),
      })),
  ];

  const principles = heuristicExtractPrinciples(frameworks, category);
  const mentalModels = heuristicExtractMentalModels(rawText, category);
  const concepts = heuristicExtractConcepts(rawText, category);

  return {
    frameworks,
    checklists,
    decisionRules,
    kpis,
    cases,
    principles,
    mentalModels,
    antiPatterns,
    concepts,
  };
}

export function extractionDraftToStructured(
  draft: AifExtractionDraft,
  validation: AifStructuredKnowledge["validation"],
  graph: AifStructuredKnowledge["graph"]
): AifStructuredKnowledge {
  return {
    ...draft,
    graph,
    validation,
  };
}
