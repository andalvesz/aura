import type {
  ExpertBrainCategory,
  ExpertFramework,
  ExpertPattern,
  ExpertPlaybook,
} from "@/types/database";

export const EXPERT_BRAIN_CATEGORIES: ExpertBrainCategory[] = [
  "product_creation",
  "copywriting",
  "funnel_strategy",
  "offer_creation",
  "creative_strategy",
  "paid_traffic",
  "landing_page",
  "sales_psychology",
  "launch_strategy",
  "retention",
  "scaling",
];

export const EXPERT_BRAIN_CATEGORY_LABELS: Record<ExpertBrainCategory, string> = {
  product_creation: "Criação de produto",
  copywriting: "Copywriting",
  funnel_strategy: "Estratégia de funil",
  offer_creation: "Criação de oferta",
  creative_strategy: "Estratégia criativa",
  paid_traffic: "Tráfego pago",
  landing_page: "Landing page",
  sales_psychology: "Psicologia de vendas",
  launch_strategy: "Estratégia de lançamento",
  retention: "Retenção",
  scaling: "Escala",
};

export const MODULE_TO_EXPERT_TASK: Record<string, ExpertBrainCategory> = {
  "product-factory": "product_creation",
  copylab: "copywriting",
  "offer-engine": "offer_creation",
  "funnel-engine": "funnel_strategy",
  "funnel-pages": "landing_page",
  "landing-factory": "landing_page",
  "creative-director": "creative_strategy",
  "creative-factory": "creative_strategy",
  "ads-commander": "paid_traffic",
};

export type ExpertContextFilters = {
  task?: ExpertBrainCategory | string;
  niche?: string | null;
  module?: string;
};

export type ExpertContextItem = {
  id: string;
  name: string;
  category?: ExpertBrainCategory | null;
  summary: string;
  principles?: string[];
  steps?: string[];
  rules?: string[];
  confidence?: number | null;
  source?: string;
};

export type ExpertContext = {
  task: ExpertBrainCategory;
  frameworks: ExpertContextItem[];
  playbooks: ExpertContextItem[];
  patterns: ExpertContextItem[];
  appliedFrameworks: string[];
  excellenceCriteria: string[];
};

export type ExtractedFrameworkDraft = {
  name: string;
  category: ExpertBrainCategory;
  description: string;
  principles: string[];
  when_to_use: string;
  examples: string[];
};

export type ExtractedPlaybookDraft = {
  framework_name: string;
  playbook_type: ExpertPlaybook["playbook_type"];
  title: string;
  steps: string[];
  rules: string[];
  examples: string[];
};

export type ExtractedPatternDraft = {
  pattern_type: ExpertPattern["pattern_type"];
  title: string;
  description: string;
  applies_to: ExpertBrainCategory[];
  confidence_score: number;
};

export const EXPERT_CONTEXT_PROMPT_INTRO =
  "Aplique o conhecimento especializado abaixo — transforme teoria em execução prática.";

export function emptyExpertContext(task: ExpertBrainCategory = "copywriting"): ExpertContext {
  return {
    task,
    frameworks: [],
    playbooks: [],
    patterns: [],
    appliedFrameworks: [],
    excellenceCriteria: [],
  };
}

export function isExpertContextEmpty(context: ExpertContext): boolean {
  return (
    context.frameworks.length === 0 &&
    context.playbooks.length === 0 &&
    context.patterns.length === 0
  );
}

export function resolveExpertTask(
  task?: ExpertBrainCategory | string | null,
  module?: string
): ExpertBrainCategory {
  if (task && EXPERT_BRAIN_CATEGORIES.includes(task as ExpertBrainCategory)) {
    return task as ExpertBrainCategory;
  }
  if (module && MODULE_TO_EXPERT_TASK[module]) {
    return MODULE_TO_EXPERT_TASK[module];
  }
  return "copywriting";
}

export function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function frameworkToContextItem(framework: ExpertFramework): ExpertContextItem {
  return {
    id: framework.id,
    name: framework.name,
    category: framework.category,
    summary: framework.description?.trim() || framework.when_to_use?.trim() || framework.name,
    principles: readStringArray(framework.principles),
    source: "expert_framework",
  };
}

export function playbookToContextItem(playbook: ExpertPlaybook): ExpertContextItem {
  return {
    id: playbook.id,
    name: playbook.title,
    summary: playbook.title,
    steps: readStringArray(playbook.steps),
    rules: readStringArray(playbook.rules),
    source: "expert_playbook",
  };
}

export function patternToContextItem(pattern: ExpertPattern): ExpertContextItem {
  return {
    id: pattern.id,
    name: pattern.title,
    summary: pattern.description?.trim() || pattern.title,
    confidence: pattern.confidence_score,
    source: "expert_pattern",
  };
}

export function patternAppliesToTask(pattern: ExpertPattern, task: ExpertBrainCategory): boolean {
  const applies = readStringArray(pattern.applies_to);
  if (applies.length === 0) return true;
  return applies.includes(task);
}

export function rankFrameworksForTask(
  frameworks: ExpertFramework[],
  task: ExpertBrainCategory,
  niche?: string | null
): ExpertFramework[] {
  const nicheLower = niche?.trim().toLowerCase() ?? "";

  return [...frameworks]
    .map((framework) => {
      let score = framework.category === task ? 40 : 0;
      const principles = readStringArray(framework.principles);
      score += Math.min(principles.length * 3, 15);
      if (framework.description?.trim()) score += 5;
      if (framework.when_to_use?.trim()) score += 5;

      const haystack = `${framework.name} ${framework.description ?? ""} ${framework.when_to_use ?? ""}`.toLowerCase();
      if (nicheLower && haystack.includes(nicheLower)) score += 20;

      const metaNiche =
        typeof framework.metadata === "object" &&
        framework.metadata &&
        "niche" in framework.metadata &&
        typeof (framework.metadata as { niche?: string }).niche === "string"
          ? (framework.metadata as { niche: string }).niche.toLowerCase()
          : "";
      if (nicheLower && metaNiche && metaNiche.includes(nicheLower)) score += 10;

      return { framework, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.framework);
}

export function collectExcellenceCriteria(frameworks: ExpertContextItem[]): string[] {
  const criteria = new Set<string>();
  for (const framework of frameworks) {
    for (const principle of framework.principles ?? []) {
      criteria.add(principle.trim());
    }
  }
  return Array.from(criteria).slice(0, 12);
}

function formatExpertItem(item: ExpertContextItem): string {
  const parts = [`• ${item.name}`];
  if (item.confidence != null) parts.push(`(confiança ${item.confidence})`);
  if (item.summary && item.summary !== item.name) parts.push(`— ${item.summary}`);
  return parts.join(" ");
}

function formatExpertSection(title: string, items: ExpertContextItem[]): string | null {
  if (items.length === 0) return null;
  return [title, ...items.map(formatExpertItem)].join("\n");
}

export function buildExpertContextPromptBlock(context: ExpertContext): string {
  if (isExpertContextEmpty(context)) return "";

  const frameworkCitations =
    context.appliedFrameworks.length > 0
      ? context.appliedFrameworks.map((name) => `Aplicando framework: ${name}`).join("\n")
      : null;

  const playbookDetails = context.playbooks
    .flatMap((playbook) => {
      const lines: string[] = [];
      if (playbook.steps?.length) {
        lines.push(`Passos (${playbook.name}): ${playbook.steps.slice(0, 5).join(" → ")}`);
      }
      if (playbook.rules?.length) {
        lines.push(`Regras (${playbook.name}): ${playbook.rules.slice(0, 4).join("; ")}`);
      }
      return lines;
    })
    .slice(0, 6);

  const criteriaBlock =
    context.excellenceCriteria.length > 0
      ? [
          "Critérios de excelência (frameworks expert):",
          ...context.excellenceCriteria.map((c) => `• ${c}`),
        ].join("\n")
      : null;

  const sections = [
    EXPERT_CONTEXT_PROMPT_INTRO,
    frameworkCitations,
    formatExpertSection("Frameworks expert:", context.frameworks),
    formatExpertSection("Playbooks expert:", context.playbooks),
    formatExpertSection("Padrões expert:", context.patterns),
    playbookDetails.length ? playbookDetails.join("\n") : null,
    criteriaBlock,
  ].filter(Boolean);

  return sections.join("\n\n");
}

export function buildExcellenceCriteriaPromptBlock(criteria: string[]): string {
  if (criteria.length === 0) return "";
  return [
    "Critérios de qualidade derivados do Expert Brain:",
    ...criteria.map((c) => `• ${c}`),
  ].join("\n");
}

export function logExpertContextInjected(module: string, context: ExpertContext): void {
  console.info("[expert-brain] injected", {
    module,
    task: context.task,
    frameworks: context.frameworks.length,
    playbooks: context.playbooks.length,
    patterns: context.patterns.length,
    appliedFrameworks: context.appliedFrameworks.length,
  });
}

export function logExpertContextApplied(module: string): void {
  console.info("[expert-brain] applied", { module });
}

export function applyExpertContextToPrompt(
  systemPrompt: string,
  promptBlock: string,
  module: string
): string {
  if (!promptBlock.trim()) return systemPrompt;
  logExpertContextApplied(module);
  return `${systemPrompt}\n\n${promptBlock}`;
}

export function heuristicExtractFrameworks(
  rawText: string,
  niche?: string | null
): ExtractedFrameworkDraft[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const frameworks: ExtractedFrameworkDraft[] = [];
  let current: ExtractedFrameworkDraft | null = null;

  for (const line of lines) {
    const heading = line.match(/^(?:#{1,3}\s+|\d+[\).]\s+)(.+)/);
    if (heading) {
      if (current) frameworks.push(current);
      current = {
        name: heading[1].trim().slice(0, 120),
        category: inferCategoryFromText(heading[1], niche),
        description: "",
        principles: [],
        when_to_use: "",
        examples: [],
      };
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.+)/);
    if (bullet && current) {
      current.principles.push(bullet[1].trim());
      continue;
    }

    if (current && !current.description) {
      current.description = line.slice(0, 280);
    }
  }

  if (current) frameworks.push(current);

  if (frameworks.length === 0 && rawText.trim().length > 40) {
    frameworks.push({
      name: "Framework extraído do material",
      category: inferCategoryFromText(rawText, niche),
      description: rawText.trim().slice(0, 400),
      principles: lines.filter((l) => l.length > 20).slice(0, 5),
      when_to_use: "Quando o contexto do material for relevante para a tarefa.",
      examples: [],
    });
  }

  return frameworks.slice(0, 6);
}

export function heuristicExtractPlaybooks(
  frameworks: ExtractedFrameworkDraft[]
): ExtractedPlaybookDraft[] {
  return frameworks.map((framework) => ({
    framework_name: framework.name,
    playbook_type: "checklist",
    title: `Playbook — ${framework.name}`,
    steps: framework.principles.length
      ? framework.principles
      : ["Diagnosticar contexto", "Aplicar princípios do framework", "Validar resultado"],
    rules: [
      "Não pular etapas críticas do framework",
      "Adaptar ao nicho sem diluir o método",
    ],
    examples: framework.examples,
  }));
}

export function heuristicExtractPatterns(
  frameworks: ExtractedFrameworkDraft[],
  sourceId?: string
): ExtractedPatternDraft[] {
  const patterns: ExtractedPatternDraft[] = [];

  for (const framework of frameworks) {
    for (const principle of framework.principles.slice(0, 3)) {
      patterns.push({
        pattern_type: "quality_criterion",
        title: principle.slice(0, 120),
        description: `Critério derivado do framework ${framework.name}`,
        applies_to: [framework.category],
        confidence_score: 72,
      });
    }

    patterns.push({
      pattern_type: "decision_rule",
      title: `Quando usar ${framework.name}`,
      description: framework.when_to_use || framework.description,
      applies_to: [framework.category],
      confidence_score: 68,
    });
  }

  if (sourceId) {
    void sourceId;
  }

  return patterns.slice(0, 12);
}

function inferCategoryFromText(text: string, niche?: string | null): ExpertBrainCategory {
  const lower = `${text} ${niche ?? ""}`.toLowerCase();
  if (lower.includes("copy") || lower.includes("headline") || lower.includes("texto")) {
    return "copywriting";
  }
  if (lower.includes("funil") || lower.includes("funnel")) return "funnel_strategy";
  if (lower.includes("oferta") || lower.includes("pricing") || lower.includes("preço")) {
    return "offer_creation";
  }
  if (lower.includes("landing") || lower.includes("página")) return "landing_page";
  if (lower.includes("criativo") || lower.includes("creative")) return "creative_strategy";
  if (lower.includes("tráfego") || lower.includes("ads") || lower.includes("meta")) {
    return "paid_traffic";
  }
  if (lower.includes("lançamento") || lower.includes("launch")) return "launch_strategy";
  if (lower.includes("produto") || lower.includes("ebook")) return "product_creation";
  return "copywriting";
}
