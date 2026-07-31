/**
 * Generate Learning Proposals from patterns. Never APPLIED.
 */

import {
  MIN_SAMPLE_SIZE,
  PROPOSAL_TTL_MS,
} from "@/lib/learning/types";
import { hashPayload } from "@/lib/learning/store";
import { proposalPayload, validateProposedChange } from "@/lib/learning/policy";
import type {
  LearningPattern,
  LearningProposal,
  LearningProposalType,
  LearningProposedChange,
  LearningState,
  LearningSuppression,
} from "@/lib/learning/types";

function nid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function mapProposalType(pattern: LearningPattern): LearningProposalType {
  if (pattern.patternKey.startsWith("recommendation:")) {
    return pattern.patternKey.endsWith(":neg")
      ? "SUPPRESSION_SUGGESTION"
      : "RECOMMENDATION_FILTER";
  }
  if (pattern.patternKey.startsWith("conversation:")) {
    return "COMMUNICATION_STYLE_UPDATE";
  }
  if (pattern.patternKey.startsWith("automation:")) {
    return "AUTOMATION_LIMIT_SUGGESTION";
  }
  if (pattern.patternKey.startsWith("agent-runtime:")) {
    return "AGENT_POLICY_SUGGESTION";
  }
  if (pattern.patternKey.startsWith("planner:")) {
    return pattern.patternKey.includes("deadline")
      ? "DEADLINE_ESTIMATE_UPDATE"
      : "PLANNING_RULE_UPDATE";
  }
  if (pattern.patternKey.startsWith("memory:")) {
    return "MEMORY_RETENTION_SUGGESTION";
  }
  if (pattern.patternKey.startsWith("identity:")) {
    return "PREFERENCE_UPDATE";
  }
  return "CONTEXT_RULE_SUGGESTION";
}

function buildChange(pattern: LearningPattern): LearningProposedChange {
  const type = mapProposalType(pattern);
  const after: Record<string, unknown> = {
    patternKey: pattern.patternKey,
    suggestion: pattern.summary,
  };
  if (type === "AUTOMATION_LIMIT_SUGGESTION") {
    after.reduceDailyLimit = true;
    after.increaseConfirmation = true;
  }
  if (type === "AGENT_POLICY_SUGGESTION") {
    after.reduceBudget = true;
    after.requireExtraConfirm = true;
  }
  if (type === "COMMUNICATION_STYLE_UPDATE") {
    after.tone = "concise";
  }
  if (type === "SUPPRESSION_SUGGESTION") {
    after.suppressCategory = pattern.patternKey;
  }

  return {
    kind: type.toLowerCase(),
    component: pattern.patternKey.split(":")[0] ?? "unknown",
    description: pattern.summary,
    beforeSnapshot: {},
    afterSnapshot: after,
    elevatesAutonomy: false,
    removesConfirmation: false,
    expandsAllowlist: false,
    financial: false,
    sensitiveInference: false,
  };
}

function isSuppressed(
  suppressions: LearningSuppression[],
  userId: string,
  patternKey: string,
  proposalType: LearningProposalType,
  now: string
): boolean {
  return suppressions.some((s) => {
    if (s.userId !== userId) return false;
    if (s.patternKey !== patternKey && s.proposalType !== proposalType) return false;
    if (s.expiresAt && new Date(s.expiresAt).getTime() < new Date(now).getTime()) {
      return false;
    }
    return s.patternKey === patternKey;
  });
}

export function generateLearningProposals(
  state: LearningState,
  opts: { userId: string; minSampleSize?: number; now?: string }
): { state: LearningState; proposals: LearningProposal[] } {
  const now = opts.now ?? new Date().toISOString();
  const min = opts.minSampleSize ?? MIN_SAMPLE_SIZE;
  const created: LearningProposal[] = [];

  for (const pattern of state.patterns) {
    if (pattern.userId !== opts.userId) continue;
    if (pattern.sampleSize < min) continue;

    const proposalType = mapProposalType(pattern);
    if (
      isSuppressed(
        state.suppressions,
        opts.userId,
        pattern.patternKey,
        proposalType,
        now
      )
    ) {
      continue;
    }

    // Avoid duplicate open proposals for same pattern
    const open = state.proposals.find(
      (p) =>
        !p.softDeleted &&
        p.userId === opts.userId &&
        p.patternId === pattern.id &&
        ["DRAFT", "GENERATED", "PENDING_REVIEW", "CONFIRMED"].includes(p.status)
    );
    if (open) continue;

    const change = buildChange(pattern);
    const validation = validateProposedChange(change);
    if (!validation.ok) continue;

    const draft: LearningProposal = {
      id: nid("prop"),
      userId: opts.userId,
      ownerId: opts.userId,
      workspaceId: pattern.workspaceId,
      title: `Aprender: ${pattern.title}`,
      summary: pattern.summary,
      proposalType,
      status: "GENERATED",
      scope: pattern.scope === "WORKSPACE" ? "PERSONAL" : pattern.scope, // V1 default personal
      context: {
        projectId: null,
        missionId: null,
        agentId: null,
        label: pattern.scope,
      },
      supportingSignalIds: pattern.signalIds,
      counterSignalIds: pattern.counterSignalIds,
      sampleSize: pattern.sampleSize,
      timeRange: { ...pattern.timeRange },
      confidence: pattern.confidence,
      expectedBenefit: "Melhor alinhamento com feedback observado.",
      possibleRisk: "Pode generalizar demais se o contexto mudar.",
      proposedChange: change,
      affectedComponents: [change.component],
      requiresConfirmation: true,
      validUntil: new Date(new Date(now).getTime() + PROPOSAL_TTL_MS).toISOString(),
      payloadHash: "",
      patternId: pattern.id,
      evaluationId: null,
      applicationId: null,
      createdAt: now,
      updatedAt: now,
      softDeleted: false,
      rowVersion: 1,
    };
    draft.payloadHash = hashPayload(proposalPayload(draft));
    draft.status = "PENDING_REVIEW";
    created.push(draft);
  }

  return {
    state: {
      ...state,
      proposals: [...created, ...state.proposals],
    },
    proposals: created,
  };
}
