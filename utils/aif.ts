import type { ExpertBrainCategory } from "@/types/database";

/** Aura Intelligence Factory — tipos padronizados de conhecimento estruturado */

export const AIF_PIPELINE_STAGES = [
  "import",
  "extract",
  "normalize",
  "validate",
  "graph",
  "decision_rules",
  "commit",
] as const;

export type AifPipelineStage = (typeof AIF_PIPELINE_STAGES)[number];

export const AIF_IMPORT_SOURCE_TYPES = [
  "pdf",
  "mp4",
  "docx",
  "txt",
  "zip",
  "google_drive",
  "youtube",
] as const;

export type AifImportSourceType = (typeof AIF_IMPORT_SOURCE_TYPES)[number];

export const AIF_ENTITY_TYPES = [
  "framework",
  "checklist",
  "decision_rule",
  "kpi",
  "case",
  "principle",
  "mental_model",
  "anti_pattern",
  "concept",
] as const;

export type AifEntityType = (typeof AIF_ENTITY_TYPES)[number];

export type AifConfidenceScore = {
  value: number;
  reasons: string[];
};

export type AifBaseEntity = {
  id: string;
  name: string;
  category: ExpertBrainCategory;
  summary: string;
  confidence: AifConfidenceScore;
  sourceRef?: string | null;
  tags?: string[];
};

export type AifFramework = AifBaseEntity & {
  type: "framework";
  principles: string[];
  whenToUse: string;
  examples: string[];
};

export type AifChecklist = AifBaseEntity & {
  type: "checklist";
  items: string[];
  passCriteria: string;
  checklistType: "operational" | "quality" | "launch" | "validation" | "scaling" | "other";
};

export type AifDecisionRule = AifBaseEntity & {
  type: "decision_rule";
  rule: string;
  whenToApply: string;
  whenNotToApply: string;
  priority: number;
  frameworkRef?: string | null;
};

export type AifKpi = AifBaseEntity & {
  type: "kpi";
  metric: string;
  target: string;
  measurement: string;
  frequency: string;
};

export type AifCase = AifBaseEntity & {
  type: "case";
  context: string;
  actions: string[];
  outcome: string;
  lessons: string[];
};

export type AifPrinciple = AifBaseEntity & {
  type: "principle";
  statement: string;
  rationale: string;
};

export type AifMentalModel = AifBaseEntity & {
  type: "mental_model";
  model: string;
  application: string;
  pitfalls: string[];
};

export type AifAntiPattern = AifBaseEntity & {
  type: "anti_pattern";
  warningSigns: string[];
  consequences: string[];
  prevention: string[];
};

export type AifConcept = AifBaseEntity & {
  type: "concept";
  definition: string;
  relatedConcepts: string[];
};

export type AifKnowledgeEntity =
  | AifFramework
  | AifChecklist
  | AifDecisionRule
  | AifKpi
  | AifCase
  | AifPrinciple
  | AifMentalModel
  | AifAntiPattern
  | AifConcept;

export type AifGraphNodeType =
  | "offer"
  | "landing"
  | "copy"
  | "creative"
  | "conversion"
  | "framework"
  | "checklist"
  | "decision_rule"
  | "kpi"
  | "case"
  | "principle"
  | "mental_model"
  | "anti_pattern"
  | "concept";

export type AifGraphNode = {
  id: string;
  label: string;
  nodeType: AifGraphNodeType;
  entityId?: string | null;
  category?: ExpertBrainCategory | null;
};

export type AifGraphEdge = {
  id: string;
  from: string;
  to: string;
  relation: "influences" | "requires" | "validates" | "blocks" | "implements" | "measures";
  weight: number;
};

export type AifKnowledgeGraph = {
  nodes: AifGraphNode[];
  edges: AifGraphEdge[];
};

export type AifValidationIssue = {
  severity: "info" | "warning" | "error";
  code: "duplicate" | "conflict" | "contradiction" | "low_confidence" | "missing_operational";
  message: string;
  entityIds: string[];
};

export type AifValidationReport = {
  passed: boolean;
  issues: AifValidationIssue[];
  deduplicatedCount: number;
  averageConfidence: number;
};

export type AifStructuredKnowledge = {
  frameworks: AifFramework[];
  checklists: AifChecklist[];
  decisionRules: AifDecisionRule[];
  kpis: AifKpi[];
  cases: AifCase[];
  principles: AifPrinciple[];
  mentalModels: AifMentalModel[];
  antiPatterns: AifAntiPattern[];
  concepts: AifConcept[];
  graph: AifKnowledgeGraph;
  validation: AifValidationReport;
};

export type AifImportResult = {
  rawText: string;
  sourceType: AifImportSourceType | string;
  title: string;
  wordCount: number;
  error: string | null;
};

export type AifPipelineInput = {
  title: string;
  author?: string | null;
  niche?: string | null;
  origin?: string | null;
  sourceType: AifImportSourceType | string;
  rawText?: string;
  buffer?: Buffer;
  fileName?: string;
  courseId?: string | null;
  moduleId?: string | null;
  lessonId?: string | null;
  existingSourceId?: string | null;
};

export type AifPipelineResult = {
  stage: AifPipelineStage;
  import: AifImportResult | null;
  knowledge: AifStructuredKnowledge | null;
  expertSourceId: string | null;
  error: string | null;
};

export const AIF_FUNNEL_CHAIN: Array<{ id: string; label: string; nodeType: AifGraphNodeType }> = [
  { id: "funnel-offer", label: "Oferta", nodeType: "offer" },
  { id: "funnel-landing", label: "Landing", nodeType: "landing" },
  { id: "funnel-copy", label: "Copy", nodeType: "copy" },
  { id: "funnel-creative", label: "Criativos", nodeType: "creative" },
  { id: "funnel-conversion", label: "Conversão", nodeType: "conversion" },
];

export function normalizeAifKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function createAifId(prefix: string, seed: string): string {
  const slug = normalizeAifKey(seed).replace(/\s+/g, "-").slice(0, 48);
  return `${prefix}-${slug || "entity"}`;
}

export function buildAifConfidence(value: number, reasons: string[] = []): AifConfidenceScore {
  return {
    value: Math.max(0, Math.min(100, Math.round(value))),
    reasons,
  };
}

export function inferCategoryFromNiche(niche?: string | null): ExpertBrainCategory {
  const lower = (niche ?? "").toLowerCase();
  if (lower.includes("copy")) return "copywriting";
  if (lower.includes("funil") || lower.includes("funnel")) return "funnel_strategy";
  if (lower.includes("oferta") || lower.includes("offer")) return "offer_creation";
  if (lower.includes("criativ") || lower.includes("creative")) return "creative_strategy";
  if (lower.includes("traf") || lower.includes("ads")) return "paid_traffic";
  if (lower.includes("landing")) return "landing_page";
  if (lower.includes("lanc") || lower.includes("launch")) return "launch_strategy";
  if (lower.includes("escala") || lower.includes("scale")) return "scaling";
  if (lower.includes("produto") || lower.includes("product")) return "product_creation";
  return "copywriting";
}

export function countAifEntities(knowledge: AifStructuredKnowledge): number {
  return (
    knowledge.frameworks.length +
    knowledge.checklists.length +
    knowledge.decisionRules.length +
    knowledge.kpis.length +
    knowledge.cases.length +
    knowledge.principles.length +
    knowledge.mentalModels.length +
    knowledge.antiPatterns.length +
    knowledge.concepts.length
  );
}

export function buildAifCeoKnowledgeBlock(knowledge: AifStructuredKnowledge): string {
  const lines: string[] = [
    "## Conhecimento Estruturado (Aura Intelligence Factory)",
    "Use apenas o conhecimento abaixo — nunca conteúdo bruto de cursos.",
    "",
  ];

  if (knowledge.frameworks.length) {
    lines.push("### Frameworks");
    for (const fw of knowledge.frameworks.slice(0, 5)) {
      lines.push(`- **${fw.name}** (${fw.category}, confiança ${fw.confidence.value}%): ${fw.summary}`);
      if (fw.principles.length) lines.push(`  Princípios: ${fw.principles.slice(0, 3).join("; ")}`);
    }
    lines.push("");
  }

  if (knowledge.decisionRules.length) {
    lines.push("### Regras de Decisão");
    for (const rule of knowledge.decisionRules.slice(0, 6)) {
      lines.push(
        `- **${rule.name}**: ${rule.rule} (aplicar: ${rule.whenToApply}; evitar: ${rule.whenNotToApply})`
      );
    }
    lines.push("");
  }

  if (knowledge.kpis.length) {
    lines.push("### KPIs");
    for (const kpi of knowledge.kpis.slice(0, 4)) {
      lines.push(`- ${kpi.metric}: meta ${kpi.target} (${kpi.frequency})`);
    }
    lines.push("");
  }

  if (knowledge.antiPatterns.length) {
    lines.push("### Anti-patterns");
    for (const ap of knowledge.antiPatterns.slice(0, 4)) {
      lines.push(`- ${ap.name}: ${ap.summary}`);
    }
    lines.push("");
  }

  if (knowledge.graph.edges.length) {
    lines.push("### Cadeia de Valor");
    lines.push(
      knowledge.graph.nodes
        .filter((n) => n.nodeType === "offer" || n.nodeType === "conversion" || n.id.startsWith("funnel-"))
        .map((n) => n.label)
        .join(" → ")
    );
  }

  return lines.join("\n").trim();
}

export function buildAifExpertContextBlock(params: {
  task: ExpertBrainCategory;
  frameworks: Array<{ name: string; summary: string; principles?: string[] }>;
  decisionRules: Array<{ name: string; rule: string; whenToApply: string }>;
  checklists: Array<{ name: string; items: string[] }>;
}): string {
  const lines = [
    `## Expert Brain — ${params.task}`,
    "Conhecimento operacional estruturado (sem conteúdo bruto).",
    "",
  ];

  if (params.frameworks.length) {
    lines.push("### Frameworks aplicáveis");
    for (const fw of params.frameworks.slice(0, 4)) {
      lines.push(`- ${fw.name}: ${fw.summary}`);
    }
    lines.push("");
  }

  if (params.decisionRules.length) {
    lines.push("### Regras");
    for (const rule of params.decisionRules.slice(0, 5)) {
      lines.push(`- ${rule.name}: ${rule.rule} (quando: ${rule.whenToApply})`);
    }
    lines.push("");
  }

  if (params.checklists.length) {
    lines.push("### Checklists");
    for (const cl of params.checklists.slice(0, 3)) {
      lines.push(`- ${cl.name}: ${cl.items.slice(0, 4).join("; ")}`);
    }
  }

  return lines.join("\n").trim();
}
