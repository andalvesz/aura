import type { ExpertBrainCategory } from "@/types/database";
import {
  buildAifConfidence,
  createAifId,
  type AifDecisionRule,
  type AifFramework,
} from "@/utils/aif";
import type { AifExtractionDraft } from "./knowledge-extractor";

function ruleFromFramework(fw: AifFramework, index: number): AifDecisionRule {
  const principle = fw.principles[0] ?? fw.summary;
  return {
    id: createAifId("decision-rule", `${fw.name}-auto-${index}`),
    type: "decision_rule",
    name: `Aplicar ${fw.name}`,
    category: fw.category,
    summary: `Regra operacional derivada de ${fw.name}`,
    rule: `Seguir o framework ${fw.name}: ${principle}`,
    whenToApply: fw.whenToUse || `Contexto de ${fw.category}`,
    whenNotToApply: "Quando pré-requisitos do framework não estiverem presentes",
    priority: 60 - index,
    frameworkRef: fw.name,
    confidence: buildAifConfidence(62, ["gerada automaticamente a partir de framework"]),
  };
}

function ruleFromChecklistItem(
  checklistName: string,
  item: string,
  category: ExpertBrainCategory,
  index: number
): AifDecisionRule {
  return {
    id: createAifId("decision-rule", `${checklistName}-${index}`),
    type: "decision_rule",
    name: `Checklist: ${item.slice(0, 50)}`,
    category,
    summary: item,
    rule: `Executar: ${item}`,
    whenToApply: `Durante validação de ${checklistName}`,
    whenNotToApply: "Quando item já validado e documentado",
    priority: 40,
    frameworkRef: null,
    confidence: buildAifConfidence(58, ["derivada de checklist"]),
  };
}

export function ensureAifOperationalDecisionRules(draft: AifExtractionDraft): AifExtractionDraft {
  const rules = [...draft.decisionRules];
  const existingKeys = new Set(rules.map((r) => r.name.toLowerCase()));

  for (const [index, fw] of draft.frameworks.entries()) {
    const autoName = `aplicar ${fw.name}`.toLowerCase();
    const hasRule = rules.some(
      (r) =>
        r.frameworkRef?.toLowerCase() === fw.name.toLowerCase() ||
        r.name.toLowerCase().includes(fw.name.toLowerCase())
    );
    if (!hasRule && !existingKeys.has(autoName) && index < 4) {
      const generated = ruleFromFramework(fw, index);
      rules.push(generated);
      existingKeys.add(generated.name.toLowerCase());
    }
  }

  if (rules.length < 3 && draft.checklists.length) {
    const checklist = draft.checklists[0];
    for (const [i, item] of checklist.items.slice(0, 3).entries()) {
      const generated = ruleFromChecklistItem(checklist.name, item, checklist.category, i);
      if (!existingKeys.has(generated.name.toLowerCase())) {
        rules.push(generated);
        existingKeys.add(generated.name.toLowerCase());
      }
    }
  }

  return {
    ...draft,
    decisionRules: rules.filter((r) => r.rule.trim().length >= 8),
  };
}

export function formatDecisionRulesForExpertBrain(rules: AifDecisionRule[]): string {
  return rules
    .slice(0, 12)
    .map(
      (r, i) =>
        `${i + 1}. [${r.category}] ${r.name}: ${r.rule}\n   Aplicar: ${r.whenToApply}\n   Evitar: ${r.whenNotToApply}`
    )
    .join("\n\n");
}

export function isOperationalDecisionRule(rule: AifDecisionRule): boolean {
  return (
    rule.rule.trim().length >= 12 &&
    Boolean(rule.whenToApply?.trim()) &&
    Boolean(rule.whenNotToApply?.trim())
  );
}

export function filterOperationalRules(rules: AifDecisionRule[]): AifDecisionRule[] {
  return rules.filter(isOperationalDecisionRule);
}
