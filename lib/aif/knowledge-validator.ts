import { normalizeAifKey, buildAifConfidence, type AifStructuredKnowledge, type AifValidationIssue, type AifValidationReport } from "@/utils/aif";
import type { AifExtractionDraft } from "./knowledge-extractor";

function dedupeByName<T extends { name: string; confidence: { value: number } }>(items: T[]): {
  kept: T[];
  removed: number;
} {
  const map = new Map<string, T>();
  let removed = 0;

  for (const item of items) {
    const key = normalizeAifKey(item.name);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      continue;
    }
    removed += 1;
    if (item.confidence.value > existing.confidence.value) {
      map.set(key, item);
    }
  }

  return { kept: [...map.values()], removed };
}

function detectRuleConflicts(draft: AifExtractionDraft): AifValidationIssue[] {
  const issues: AifValidationIssue[] = [];
  const rules = draft.decisionRules;

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i];
      const b = rules[j];
      if (a.category !== b.category) continue;

      const aKey = normalizeAifKey(a.rule);
      const bKey = normalizeAifKey(b.rule);
      if (aKey === bKey) continue;

      const aNeg = normalizeAifKey(a.whenNotToApply);
      const bApply = normalizeAifKey(b.whenToApply);
      if (aNeg && bApply && aNeg.includes(bApply.slice(0, 20))) {
        issues.push({
          severity: "warning",
          code: "contradiction",
          message: `Possível contradição entre "${a.name}" e "${b.name}".`,
          entityIds: [a.id, b.id],
        });
      }
    }
  }

  return issues;
}

function detectDuplicates(draft: AifExtractionDraft): AifValidationIssue[] {
  const issues: AifValidationIssue[] = [];
  const groups: Array<{ label: string; items: Array<{ id: string; name: string }> }> = [
    { label: "frameworks", items: draft.frameworks },
    { label: "decision rules", items: draft.decisionRules },
    { label: "checklists", items: draft.checklists },
  ];

  for (const group of groups) {
    const seen = new Map<string, string[]>();
    for (const item of group.items) {
      const key = normalizeAifKey(item.name);
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(item.id);
    }
    for (const [name, ids] of seen) {
      if (ids.length > 1) {
        issues.push({
          severity: "warning",
          code: "duplicate",
          message: `Duplicata em ${group.label}: "${name}".`,
          entityIds: ids,
        });
      }
    }
  }

  return issues;
}

function detectLowConfidence(draft: AifExtractionDraft): AifValidationIssue[] {
  const issues: AifValidationIssue[] = [];
  const all = [
    ...draft.frameworks,
    ...draft.decisionRules,
    ...draft.checklists,
    ...draft.kpis,
  ];

  for (const entity of all) {
    if (entity.confidence.value < 45) {
      issues.push({
        severity: "info",
        code: "low_confidence",
        message: `Baixa confiança em "${entity.name}" (${entity.confidence.value}%).`,
        entityIds: [entity.id],
      });
    }
  }

  return issues;
}

function detectNonOperationalRules(draft: AifExtractionDraft): AifValidationIssue[] {
  const issues: AifValidationIssue[] = [];
  for (const rule of draft.decisionRules) {
    if (!rule.whenToApply?.trim() || rule.rule.trim().length < 12) {
      issues.push({
        severity: "warning",
        code: "missing_operational",
        message: `Regra "${rule.name}" não é suficientemente operacional.`,
        entityIds: [rule.id],
      });
    }
  }
  return issues;
}

function averageConfidence(draft: AifExtractionDraft): number {
  const scores = [
    ...draft.frameworks.map((f) => f.confidence.value),
    ...draft.decisionRules.map((r) => r.confidence.value),
    ...draft.checklists.map((c) => c.confidence.value),
    ...draft.kpis.map((k) => k.confidence.value),
  ];
  if (!scores.length) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function runAifKnowledgeValidator(draft: AifExtractionDraft): {
  draft: AifExtractionDraft;
  report: AifValidationReport;
} {
  const fw = dedupeByName(draft.frameworks);
  const rules = dedupeByName(draft.decisionRules);
  const checklists = dedupeByName(draft.checklists);
  const kpis = dedupeByName(draft.kpis);
  const cases = dedupeByName(draft.cases);
  const principles = dedupeByName(draft.principles);
  const mentalModels = dedupeByName(draft.mentalModels);
  const antiPatterns = dedupeByName(draft.antiPatterns);
  const concepts = dedupeByName(draft.concepts);

  const deduplicatedCount =
    fw.removed +
    rules.removed +
    checklists.removed +
    kpis.removed +
    cases.removed +
    principles.removed +
    mentalModels.removed +
    antiPatterns.removed +
    concepts.removed;

  const validatedDraft: AifExtractionDraft = {
    frameworks: fw.kept,
    checklists: checklists.kept,
    decisionRules: rules.kept,
    kpis: kpis.kept,
    cases: cases.kept,
    principles: principles.kept,
    mentalModels: mentalModels.kept,
    antiPatterns: antiPatterns.kept,
    concepts: concepts.kept,
  };

  const issues: AifValidationIssue[] = [
    ...detectDuplicates(validatedDraft),
    ...detectRuleConflicts(validatedDraft),
    ...detectLowConfidence(validatedDraft),
    ...detectNonOperationalRules(validatedDraft),
  ];

  const avg = averageConfidence(validatedDraft);
  const hasErrors = issues.some((i) => i.severity === "error");

  return {
    draft: validatedDraft,
    report: {
      passed: !hasErrors,
      issues,
      deduplicatedCount,
      averageConfidence: avg,
    },
  };
}

export function boostConfidenceAfterValidation(
  draft: AifExtractionDraft,
  report: AifValidationReport
): AifExtractionDraft {
  if (report.deduplicatedCount === 0 && report.averageConfidence >= 60) return draft;

  const boost = report.averageConfidence >= 70 ? 5 : 0;
  if (!boost) return draft;

  return {
    ...draft,
    frameworks: draft.frameworks.map((f) => ({
      ...f,
      confidence: buildAifConfidence(f.confidence.value + boost, [
        ...f.confidence.reasons,
        "validação AIF",
      ]),
    })),
    decisionRules: draft.decisionRules.map((r) => ({
      ...r,
      confidence: buildAifConfidence(r.confidence.value + boost, [
        ...r.confidence.reasons,
        "validação AIF",
      ]),
    })),
  };
}

export function attachValidationToKnowledge(
  draft: AifExtractionDraft,
  graph: AifStructuredKnowledge["graph"],
  report: AifValidationReport
): AifStructuredKnowledge {
  return {
    ...draft,
    graph,
    validation: report,
  };
}
