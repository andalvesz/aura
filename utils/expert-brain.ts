import type {
  ExpertBrainCategory,
  ExpertChecklist,
  ExpertDecisionRule,
  ExpertFailurePattern,
  ExpertFramework,
  ExpertPattern,
  ExpertPlaybook,
  ExpertSuccessPattern,
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
  "decision-engine": "scaling",
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
  decisionRules: ExpertContextItem[];
  checklists: ExpertContextItem[];
  failurePatterns: ExpertContextItem[];
  successPatterns: ExpertContextItem[];
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

export type ExtractedDecisionRuleDraft = {
  framework_name: string;
  title: string;
  category: ExpertBrainCategory;
  rule: string;
  when_to_apply: string;
  when_not_to_apply: string;
  confidence_score: number;
  priority: number;
};

export type ExtractedChecklistDraft = {
  title: string;
  checklist_type: ExpertChecklist["checklist_type"];
  items: string[];
  pass_criteria: string;
};

export type ExtractedFailurePatternDraft = {
  title: string;
  description: string;
  warning_signs: string[];
  consequences: string[];
  prevention_actions: string[];
};

export type ExtractedSuccessPatternDraft = {
  title: string;
  description: string;
  success_signals: string[];
  scaling_actions: string[];
};

export type ExpertRiskAssessmentInput = {
  produto?: string | null;
  oferta?: string | null;
  funil?: string | null;
  campanha?: string | null;
};

export type ExpertRiskAssessment = {
  risks: string[];
  failurePatterns: ExpertContextItem[];
  preventionActions: string[];
  riskScore: number;
};

export type ExpertOperationalChecklistResult = {
  checklist: ExpertContextItem;
  passed: boolean;
  failedItems: string[];
  critical: boolean;
};

export type ExpertMentorContext = {
  frameworks: ExpertContextItem[];
  decisionRules: ExpertContextItem[];
  checklists: ExpertContextItem[];
  promptBlock: string;
};

export const EXPERT_CONTEXT_PROMPT_INTRO =
  "Aplique o conhecimento especializado abaixo — transforme teoria em execução prática.";

export function emptyExpertContext(task: ExpertBrainCategory = "copywriting"): ExpertContext {
  return {
    task,
    frameworks: [],
    playbooks: [],
    patterns: [],
    decisionRules: [],
    checklists: [],
    failurePatterns: [],
    successPatterns: [],
    appliedFrameworks: [],
    excellenceCriteria: [],
  };
}

export function isExpertContextEmpty(context: ExpertContext): boolean {
  return (
    context.frameworks.length === 0 &&
    context.playbooks.length === 0 &&
    context.patterns.length === 0 &&
    context.decisionRules.length === 0 &&
    context.checklists.length === 0 &&
    context.failurePatterns.length === 0 &&
    context.successPatterns.length === 0
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

export function decisionRuleToContextItem(rule: ExpertDecisionRule): ExpertContextItem {
  return {
    id: rule.id,
    name: rule.title,
    category: rule.category,
    summary: rule.rule?.trim() || rule.title,
    rules: [rule.when_to_apply, rule.when_not_to_apply ? `Evitar: ${rule.when_not_to_apply}` : null].filter(
      (item): item is string => Boolean(item?.trim())
    ),
    confidence: rule.confidence_score,
    source: "expert_decision_rule",
  };
}

export function checklistToContextItem(checklist: ExpertChecklist): ExpertContextItem {
  return {
    id: checklist.id,
    name: checklist.title,
    summary: checklist.pass_criteria?.trim() || checklist.title,
    steps: readStringArray(checklist.items),
    source: "expert_checklist",
  };
}

export function failurePatternToContextItem(pattern: ExpertFailurePattern): ExpertContextItem {
  return {
    id: pattern.id,
    name: pattern.title,
    summary: pattern.description?.trim() || pattern.title,
    rules: readStringArray(pattern.warning_signs),
    steps: readStringArray(pattern.prevention_actions),
    source: "expert_failure_pattern",
  };
}

export function successPatternToContextItem(pattern: ExpertSuccessPattern): ExpertContextItem {
  return {
    id: pattern.id,
    name: pattern.title,
    summary: pattern.description?.trim() || pattern.title,
    principles: readStringArray(pattern.success_signals),
    steps: readStringArray(pattern.scaling_actions),
    source: "expert_success_pattern",
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
    formatExpertSection("Regras de decisão expert:", context.decisionRules),
    formatExpertSection("Checklists expert:", context.checklists),
    formatExpertSection("Padrões de sucesso expert:", context.successPatterns),
    formatExpertSection("Padrões de falha expert:", context.failurePatterns),
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
    decisionRules: context.decisionRules.length,
    checklists: context.checklists.length,
    failurePatterns: context.failurePatterns.length,
    successPatterns: context.successPatterns.length,
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

export function heuristicExtractDecisionRules(
  frameworks: ExtractedFrameworkDraft[]
): ExtractedDecisionRuleDraft[] {
  const rules: ExtractedDecisionRuleDraft[] = [];

  for (const framework of frameworks) {
    const primaryRule =
      framework.principles[0]?.trim() ||
      framework.description?.trim() ||
      framework.when_to_use?.trim() ||
      framework.name;

    rules.push({
      framework_name: framework.name,
      title: `Regra: ${framework.name}`,
      category: framework.category,
      rule: primaryRule,
      when_to_apply: framework.when_to_use || "Quando o contexto exigir este método.",
      when_not_to_apply: "Quando o avatar ou oferta não se alinham ao framework.",
      confidence_score: 75,
      priority: 5,
    });

    for (const principle of framework.principles.slice(1, 3)) {
      if (!principle.trim()) continue;
      rules.push({
        framework_name: framework.name,
        title: principle.slice(0, 120),
        category: framework.category,
        rule: principle.trim(),
        when_to_apply: `Durante execução de ${framework.name}`,
        when_not_to_apply: "Quando o princípio conflita com dados de performance.",
        confidence_score: 70,
        priority: 3,
      });
    }
  }

  return rules.slice(0, 12);
}

export function heuristicExtractChecklists(
  frameworks: ExtractedFrameworkDraft[]
): ExtractedChecklistDraft[] {
  return frameworks.map((framework) => ({
    title: `Checklist — ${framework.name}`,
    checklist_type: "operational" as const,
    items: framework.principles.length
      ? framework.principles
      : ["Validar contexto", "Aplicar framework", "Revisar entrega"],
    pass_criteria: `Todos os itens de ${framework.name} concluídos com qualidade mínima aceitável.`,
  }));
}

export function heuristicExtractFailurePatterns(
  frameworks: ExtractedFrameworkDraft[]
): ExtractedFailurePatternDraft[] {
  return frameworks.slice(0, 4).map((framework) => ({
    title: `Falha comum — ${framework.name}`,
    description: `Erro ao aplicar ${framework.name} sem seguir os princípios centrais.`,
    warning_signs: [
      "Baixa conversão persistente",
      "Copy genérica sem mecanismo único",
      "Oferta sem prova ou garantia",
    ],
    consequences: ["Desperdício de tráfego", "ROI negativo", "Operação bloqueada na aprovação"],
    prevention_actions: framework.principles.slice(0, 3).length
      ? framework.principles.slice(0, 3)
      : ["Revisar framework antes de escalar", "Validar checklist operacional"],
  }));
}

export function heuristicExtractSuccessPatterns(
  frameworks: ExtractedFrameworkDraft[]
): ExtractedSuccessPatternDraft[] {
  return frameworks.slice(0, 4).map((framework) => ({
    title: `Sucesso — ${framework.name}`,
    description: `Padrão vencedor derivado de ${framework.name}.`,
    success_signals: [
      "CTR acima da média do nicho",
      "Taxa de conversão estável",
      "Feedback positivo do avatar",
    ],
    scaling_actions: framework.principles.slice(0, 3).length
      ? framework.principles.slice(0, 3)
      : ["Duplicar criativos vencedores", "Expandir orçamento gradualmente"],
  }));
}

const STRATEGIC_MENTOR_PHRASES = [
  "copy",
  "funil",
  "oferta",
  "landing",
  "criativo",
  "tráfego",
  "lancamento",
  "lançamento",
  "escala",
  "conversão",
  "conversao",
  "estratégia",
  "estrategia",
  "marketing digital",
  "headline",
  "vendas online",
] as const;

export function isStrategicExpertQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return STRATEGIC_MENTOR_PHRASES.some((phrase) => lower.includes(phrase));
}

export function buildExpertMentorPromptBlock(context: ExpertMentorContext): string {
  if (
    context.frameworks.length === 0 &&
    context.decisionRules.length === 0 &&
    context.checklists.length === 0
  ) {
    return "";
  }

  const sections = [
    "Expert Brain — cite framework, regra e checklist utilizados quando responder:",
    context.frameworks.length
      ? ["Frameworks disponíveis:", ...context.frameworks.map((f) => `• ${f.name}`)].join("\n")
      : null,
    context.decisionRules.length
      ? [
          "Regras de decisão:",
          ...context.decisionRules.map((r) => `• ${r.name}: ${r.summary}`),
        ].join("\n")
      : null,
    context.checklists.length
      ? [
          "Checklists:",
          ...context.checklists.map((c) => `• ${c.name}: ${(c.steps ?? []).slice(0, 4).join("; ")}`),
        ].join("\n")
      : null,
    "Ao responder, inclua explicitamente: framework utilizado, regra utilizada e checklist utilizado (quando aplicável).",
  ].filter(Boolean);

  return sections.join("\n\n");
}

export function buildExpertRiskAssessmentFromPatterns(
  input: ExpertRiskAssessmentInput,
  failurePatterns: ExpertFailurePattern[]
): ExpertRiskAssessment {
  const corpus = [input.produto, input.oferta, input.funil, input.campanha]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .toLowerCase();

  const matched = failurePatterns
    .map((pattern) => {
      const warningSigns = readStringArray(pattern.warning_signs);
      const hits = warningSigns.filter((sign) => corpus.includes(sign.toLowerCase().slice(0, 12)));
      const titleHit = pattern.title && corpus.includes(pattern.title.toLowerCase().slice(0, 8));
      const score = hits.length * 15 + (titleHit ? 10 : 0);
      return { pattern, score, hits };
    })
    .filter((entry) => entry.score > 0 || failurePatterns.length <= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const selected = matched.length > 0 ? matched : failurePatterns.slice(0, 3).map((pattern) => ({
    pattern,
    score: 20,
    hits: readStringArray(pattern.warning_signs).slice(0, 2),
  }));

  const failureItems = selected.map((entry) => failurePatternToContextItem(entry.pattern));
  const risks = selected.flatMap((entry) =>
    entry.hits.length > 0
      ? entry.hits.map((hit) => `${entry.pattern.title}: sinal ${hit}`)
      : [`${entry.pattern.title}: risco potencial detectado`]
  );
  const preventionActions = selected.flatMap((entry) =>
    readStringArray(entry.pattern.prevention_actions).slice(0, 2)
  );

  const riskScore = Math.min(100, selected.reduce((sum, entry) => sum + entry.score, 0));

  return {
    risks: risks.slice(0, 8),
    failurePatterns: failureItems,
    preventionActions: [...new Set(preventionActions)].slice(0, 8),
    riskScore,
  };
}

type OperationStepSnapshot = Record<string, "pending" | "in_progress" | "done">;

const CHECKLIST_STEP_HINTS: Array<{ keywords: string[]; step: string }> = [
  { keywords: ["produto", "product"], step: "produto" },
  { keywords: ["persona", "avatar"], step: "persona" },
  { keywords: ["oferta", "offer", "pricing"], step: "oferta" },
  { keywords: ["copy", "texto", "headline"], step: "copy" },
  { keywords: ["criativo", "creative", "anúncio", "anuncio"], step: "criativos" },
  { keywords: ["landing", "página", "pagina"], step: "landing" },
  { keywords: ["meta", "ads", "campanha"], step: "meta_ads" },
  { keywords: ["performance", "métrica", "metrica"], step: "performance_ai" },
  { keywords: ["aprova", "approval"], step: "aprovacao" },
];

function inferChecklistItemStep(item: string): string | null {
  const lower = item.toLowerCase();
  for (const hint of CHECKLIST_STEP_HINTS) {
    if (hint.keywords.some((keyword) => lower.includes(keyword))) {
      return hint.step;
    }
  }
  return null;
}

export function evaluateExpertOperationalChecklist(
  checklist: ExpertChecklist,
  steps: OperationStepSnapshot
): ExpertOperationalChecklistResult {
  const items = readStringArray(checklist.items);
  const failedItems: string[] = [];

  for (const item of items) {
    const stepKey = inferChecklistItemStep(item);
    if (!stepKey) continue;
    if (steps[stepKey] !== "done") {
      failedItems.push(item);
    }
  }

  const metadata =
    typeof checklist.metadata === "object" && checklist.metadata ? checklist.metadata : {};
  const critical =
    checklist.checklist_type === "operational" ||
    (metadata as { critical?: boolean }).critical === true;

  return {
    checklist: checklistToContextItem(checklist),
    passed: failedItems.length === 0,
    failedItems,
    critical,
  };
}

export function collectExpertChecklistCriteria(checklists: ExpertChecklist[]): string[] {
  const criteria = new Set<string>();
  for (const checklist of checklists) {
    if (checklist.pass_criteria?.trim()) {
      criteria.add(checklist.pass_criteria.trim());
    }
    for (const item of readStringArray(checklist.items)) {
      criteria.add(item);
    }
  }
  return Array.from(criteria).slice(0, 12);
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
