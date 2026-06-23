import type { Json } from "@/types/database";
import type { AppliedKnowledge } from "@/utils/knowledge-sources";
import type { ExpertContext } from "@/utils/expert-brain";
import { buildAppliedKnowledgeFromContext } from "@/utils/knowledge-sources";
import { KnowledgeInfluenceLogsRepository } from "@/lib/supabase/repositories/knowledge-sources.repository";
import { getOptionalDataContext } from "./context";

export async function recordKnowledgeInfluence(params: {
  module: string;
  context: ExpertContext;
  generationId?: string | null;
}): Promise<AppliedKnowledge> {
  const applied = buildAppliedKnowledgeFromContext(params.context);
  const ctx = await getOptionalDataContext();
  if (!ctx) return applied;

  const hasContent =
    applied.frameworks.length > 0 ||
    applied.decisionRules.length > 0 ||
    applied.patterns.length > 0 ||
    applied.successPatterns.length > 0 ||
    applied.failurePatterns.length > 0;

  if (!hasContent) return applied;

  const repo = new KnowledgeInfluenceLogsRepository(ctx.supabase, ctx.userId);
  await repo.create({
    module: params.module,
    generation_id: params.generationId ?? null,
    frameworks: applied.frameworks as unknown as Json,
    decision_rules: applied.decisionRules as unknown as Json,
    patterns: applied.patterns as unknown as Json,
    success_patterns: applied.successPatterns as unknown as Json,
    failure_patterns: applied.failurePatterns as unknown as Json,
    metadata: { task: params.context.task } as Json,
  });

  return applied;
}

export async function getLatestAppliedKnowledge(module: string): Promise<AppliedKnowledge | null> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return null;

  const repo = new KnowledgeInfluenceLogsRepository(ctx.supabase, ctx.userId);
  const { data } = await repo.findRecentByModule(module, 1);
  const log = data?.[0];
  if (!log) return null;

  const readArray = (value: Json): string[] => {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === "string");
  };

  return {
    frameworks: readArray(log.frameworks),
    decisionRules: readArray(log.decision_rules),
    patterns: readArray(log.patterns),
    successPatterns: readArray(log.success_patterns),
    failurePatterns: readArray(log.failure_patterns),
  };
}
