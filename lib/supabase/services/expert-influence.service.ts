import type { Json } from "@/types/database";
import {
  ExpertDecisionRulesRepository,
  ExpertFrameworksRepository,
  ExpertSuccessPatternsRepository,
} from "@/lib/supabase/repositories/expert-brain.repository";
import { ExpertInfluenceLogsRepository } from "@/lib/supabase/repositories/expert-influence.repository";
import type { ExpertContext } from "@/utils/expert-brain";
import {
  buildExpertInfluenceAudit,
  INFLUENCE_WARNING_THRESHOLD,
  type ExpertInfluenceAudit,
  type ExpertInfluenceDashboard,
} from "@/utils/expert-influence";
import { buildAppliedKnowledgeFromContext, type AppliedKnowledge } from "@/utils/knowledge-sources";
import { getOptionalDataContext } from "./context";

export async function recordExpertInfluence(params: {
  moduleName: string;
  context: ExpertContext;
  promptApplied: boolean;
  generationId?: string;
}): Promise<ExpertInfluenceAudit & { appliedKnowledge: AppliedKnowledge }> {
  const audit = buildExpertInfluenceAudit({
    context: params.context,
    promptApplied: params.promptApplied,
    generationId: params.generationId,
  });
  const appliedKnowledge = buildAppliedKnowledgeFromContext(params.context);

  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { ...audit, appliedKnowledge };
  }

  const repo = new ExpertInfluenceLogsRepository(ctx.supabase, ctx.userId);
  await repo.create({
    module_name: params.moduleName,
    generation_id: audit.generationId,
    framework_ids: audit.applied.frameworkIds,
    decision_rule_ids: audit.applied.decisionRuleIds,
    success_pattern_ids: audit.applied.successPatternIds,
    failure_pattern_ids: audit.applied.failurePatternIds,
    influence_score: audit.influenceScore,
    metadata: {
      task: params.context.task,
      consulted: params.promptApplied ? audit.consulted : audit.consulted,
      applied: audit.applied,
      weights: { frameworks: 0.35, decisionRules: 0.35, successPatterns: 0.3 },
      prompt_applied: params.promptApplied,
      below_target: audit.belowTarget,
      warning: audit.warning,
    } as Json,
  });

  if (audit.belowTarget) {
    console.warn("[expert-influence] below target", {
      module: params.moduleName,
      score: audit.influenceScore,
      warning: audit.warning,
    });
  }

  return { ...audit, appliedKnowledge };
}

export async function getLatestExpertInfluence(moduleName: string): Promise<{
  audit: ExpertInfluenceAudit | null;
  appliedKnowledge: AppliedKnowledge | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { audit: null, appliedKnowledge: null };

  const repo = new ExpertInfluenceLogsRepository(ctx.supabase, ctx.userId);
  const { data } = await repo.findRecentByModule(moduleName, 1);
  const log = data?.[0];
  if (!log) return { audit: null, appliedKnowledge: null };

  const meta =
    typeof log.metadata === "object" && log.metadata && !Array.isArray(log.metadata)
      ? (log.metadata as Record<string, unknown>)
      : {};

  const readAppliedBlock = (key: "consulted" | "applied") => {
    const block = meta[key];
    if (typeof block === "object" && block && !Array.isArray(block)) {
      const obj = block as Record<string, unknown>;
      return {
        frameworkIds: (Array.isArray(obj.frameworkIds) ? obj.frameworkIds : []) as string[],
        decisionRuleIds: (Array.isArray(obj.decisionRuleIds) ? obj.decisionRuleIds : []) as string[],
        successPatternIds: (Array.isArray(obj.successPatternIds) ? obj.successPatternIds : []) as string[],
        failurePatternIds: (Array.isArray(obj.failurePatternIds) ? obj.failurePatternIds : []) as string[],
      };
    }
    return null;
  };

  const consulted = readAppliedBlock("consulted") ?? {
    frameworkIds: log.framework_ids ?? [],
    decisionRuleIds: log.decision_rule_ids ?? [],
    successPatternIds: log.success_pattern_ids ?? [],
    failurePatternIds: log.failure_pattern_ids ?? [],
  };

  const applied = readAppliedBlock("applied") ?? {
    frameworkIds: log.framework_ids ?? [],
    decisionRuleIds: log.decision_rule_ids ?? [],
    successPatternIds: log.success_pattern_ids ?? [],
    failurePatternIds: log.failure_pattern_ids ?? [],
  };

  const audit: ExpertInfluenceAudit = {
    generationId: log.generation_id ?? log.id,
    consulted,
    applied,
    influenceScore: Number(log.influence_score),
    belowTarget: Number(log.influence_score) < INFLUENCE_WARNING_THRESHOLD,
    warning: typeof meta.warning === "string" ? meta.warning : null,
  };

  const frameworksRepo = new ExpertFrameworksRepository(ctx.supabase, ctx.userId);
  const rulesRepo = new ExpertDecisionRulesRepository(ctx.supabase, ctx.userId);
  const successRepo = new ExpertSuccessPatternsRepository(ctx.supabase, ctx.userId);

  const [fw, rules, success] = await Promise.all([
    frameworksRepo.findAll(),
    rulesRepo.findTop(50),
    successRepo.findRecent(50),
  ]);

  const fwMap = new Map((fw.data ?? []).map((f) => [f.id, f.name]));
  const ruleMap = new Map((rules.data ?? []).map((r) => [r.id, r.title]));
  const successMap = new Map((success.data ?? []).map((p) => [p.id, p.title]));

  const appliedKnowledge: AppliedKnowledge = {
    frameworks: audit.applied.frameworkIds.map((id) => fwMap.get(id) ?? id.slice(0, 8)),
    decisionRules: audit.applied.decisionRuleIds.map((id) => ruleMap.get(id) ?? id.slice(0, 8)),
    patterns: [],
    successPatterns: audit.applied.successPatternIds.map((id) => successMap.get(id) ?? id.slice(0, 8)),
    failurePatterns: audit.applied.failurePatternIds.map((id) => id.slice(0, 8)),
  };

  return { audit, appliedKnowledge };
}

function countIds(logs: import("@/types/database").ExpertInfluenceLog[], field: keyof Pick<import("@/types/database").ExpertInfluenceLog, "framework_ids" | "decision_rule_ids" | "success_pattern_ids">) {
  const counts = new Map<string, number>();
  for (const log of logs) {
    const ids = log[field] ?? [];
    for (const id of ids) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return counts;
}

export async function getExpertInfluenceDashboard(): Promise<{
  dashboard: ExpertInfluenceDashboard | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { dashboard: null, error: "Usuário não autenticado." };

  const repo = new ExpertInfluenceLogsRepository(ctx.supabase, ctx.userId);
  const frameworksRepo = new ExpertFrameworksRepository(ctx.supabase, ctx.userId);
  const rulesRepo = new ExpertDecisionRulesRepository(ctx.supabase, ctx.userId);
  const successRepo = new ExpertSuccessPatternsRepository(ctx.supabase, ctx.userId);

  const [{ data: logs }, { data: frameworks }, { data: rules }, { data: successPatterns }] =
    await Promise.all([
      repo.findRecent(200),
      frameworksRepo.findAll(),
      rulesRepo.findTop(100),
      successRepo.findRecent(100),
    ]);

  const list = logs ?? [];
  if (!list.length) {
    return {
      dashboard: {
        averageScore: 0,
        totalGenerations: 0,
        belowTargetCount: 0,
        topFrameworks: [],
        topDecisionRules: [],
        topSuccessPatterns: [],
        topModules: [],
        recentLogs: [],
      },
      error: null,
    };
  }

  const fwMap = new Map((frameworks ?? []).map((f) => [f.id, f.name]));
  const ruleMap = new Map((rules ?? []).map((r) => [r.id, r.title]));
  const successMap = new Map((successPatterns ?? []).map((p) => [p.id, p.title]));

  const fwCounts = countIds(list, "framework_ids");
  const ruleCounts = countIds(list, "decision_rule_ids");
  const successCounts = countIds(list, "success_pattern_ids");

  const moduleStats = new Map<string, { count: number; scoreSum: number }>();
  for (const log of list) {
    const prev = moduleStats.get(log.module_name) ?? { count: 0, scoreSum: 0 };
    moduleStats.set(log.module_name, {
      count: prev.count + 1,
      scoreSum: prev.scoreSum + Number(log.influence_score),
    });
  }

  const scores = list.map((l) => Number(l.influence_score));
  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const belowTargetCount = list.filter((l) => Number(l.influence_score) < INFLUENCE_WARNING_THRESHOLD).length;

  return {
    dashboard: {
      averageScore: Math.round(averageScore * 100) / 100,
      totalGenerations: list.length,
      belowTargetCount,
      topFrameworks: [...fwCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id, count]) => ({ id, name: fwMap.get(id) ?? id.slice(0, 8), count })),
      topDecisionRules: [...ruleCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id, count]) => ({ id, title: ruleMap.get(id) ?? id.slice(0, 8), count })),
      topSuccessPatterns: [...successCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id, count]) => ({ id, title: successMap.get(id) ?? id.slice(0, 8), count })),
      topModules: [...moduleStats.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([module, stats]) => ({
          module,
          count: stats.count,
          averageScore: Math.round((stats.scoreSum / stats.count) * 100) / 100,
        })),
      recentLogs: list.slice(0, 20).map((log) => ({
        id: log.id,
        moduleName: log.module_name,
        influenceScore: Number(log.influence_score),
        belowTarget: Number(log.influence_score) < INFLUENCE_WARNING_THRESHOLD,
        createdAt: log.created_at,
      })),
    },
    error: null,
  };
}
