import type { KnowledgeJobStage } from "@/types/database";
import type { ExpertContext } from "@/utils/expert-brain";

export const KNOWLEDGE_JOB_STAGE_LABELS: Record<KnowledgeJobStage, string> = {
  queued: "Na fila",
  downloading: "Baixando",
  transcribing: "Transcrevendo",
  extracting: "Extraindo conhecimento",
  saving: "Salvando no Expert Brain",
  completed: "Concluído",
  failed: "Falhou",
};

export const KNOWLEDGE_JOB_STAGE_PROGRESS: Record<KnowledgeJobStage, number> = {
  queued: 5,
  downloading: 20,
  transcribing: 45,
  extracting: 70,
  saving: 90,
  completed: 100,
  failed: 0,
};

export function knowledgeJobStageColor(stage: KnowledgeJobStage): string {
  switch (stage) {
    case "completed":
      return "text-emerald-400";
    case "failed":
      return "text-red-400";
    case "queued":
      return "text-zinc-400";
    default:
      return "text-violet-400";
  }
}

export type AppliedKnowledge = {
  frameworks: string[];
  decisionRules: string[];
  patterns: string[];
  successPatterns: string[];
  failurePatterns: string[];
};

export function buildAppliedKnowledgeFromContext(context: ExpertContext): AppliedKnowledge {
  return {
    frameworks: context.frameworks.map((f) => f.name),
    decisionRules: context.decisionRules.map((r) => r.name),
    patterns: context.patterns.map((p) => p.name),
    successPatterns: context.successPatterns.map((p) => p.name),
    failurePatterns: context.failurePatterns.map((p) => p.name),
  };
}

export function hasAppliedKnowledge(applied: AppliedKnowledge): boolean {
  return (
    applied.frameworks.length > 0 ||
    applied.decisionRules.length > 0 ||
    applied.patterns.length > 0 ||
    applied.successPatterns.length > 0 ||
    applied.failurePatterns.length > 0
  );
}

export type KnowledgeInspectorData = {
  courses: Array<{
    name: string;
    modules: Array<{
      name: string;
      lessons: Array<{ name: string; status: string; progress: number }>;
    }>;
  }>;
  frameworks: Array<{ name: string; category: string }>;
  decisionRules: Array<{ title: string; rule: string }>;
  successPatterns: Array<{ title: string }>;
  failurePatterns: Array<{ title: string }>;
};

export type KnowledgeSourcesDashboard = {
  sources: import("@/types/database").KnowledgeSource[];
  jobs: import("@/types/database").KnowledgeJob[];
  driveConnected: boolean;
  driveEmail: string | null;
  inspector: KnowledgeInspectorData;
  stats: {
    total: number;
    ready: number;
    processing: number;
    failed: number;
  };
};
