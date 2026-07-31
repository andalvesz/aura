/**
 * Project Recommendation — suggests project attention based on context.
 * Never creates or alters projects.
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
  parseLevel,
} from "@/lib/recommendation/engines/_helpers";
import type { RecommendationEngine } from "@/lib/recommendation/types/types";

export const projectRecommender: RecommendationEngine = {
  id: "project_recommender_v1",
  recommendationType: "PROJECT",
  label: "Recomendador de projetos",
  description:
    "Sugere quais projetos merecem atenção no contexto atual — sem alterar board.",
  recommend(context, options) {
    const max = options.max ?? 4;
    const completeness = context.dataCompleteness.score;

    const projects = context.sources.projects
      .filter((p) => !["archived", "done", "cancelled"].includes(p.status))
      .slice(0, max * 2);

    return projects.slice(0, max).map((p, index) => {
      const decision = context.sources.decisions.find(
        (d) => d.title.toLowerCase().includes(p.name.toLowerCase().slice(0, 8))
      );
      const priority = context.sources.priorities[index] ?? context.sources.priorities[0];
      const knowledge = context.sources.knowledgeDocuments[0];
      const why = `Projeto "${p.name}" aparece no radar de contexto (#${index + 1}) — sugerir atenção, não mover status.`;
      const evidence = [
        makeEvidence({
          evidenceType: "project_signal",
          sourceLayer: "projects",
          sourceType: p.status,
          sourceId: p.id,
          summary: p.description || p.name,
          confidence: 60,
        }),
        ...(priority
          ? [
              makeEvidence({
                evidenceType: "priority_link",
                sourceLayer: "prioritization" as const,
                sourceType: priority.kind,
                sourceId: priority.id,
                summary: priority.title,
                confidence: priority.confidence,
              }),
            ]
          : []),
        ...(knowledge
          ? [
              makeEvidence({
                evidenceType: "knowledge_link",
                sourceLayer: "knowledge" as const,
                sourceType: knowledge.type,
                sourceId: knowledge.id,
                summary: knowledge.title,
                confidence: 45,
              }),
            ]
          : []),
      ];
      const alternatives = [
        {
          id: "park_project",
          title: "Manter em espera",
          summary: "Não elevar atenção neste ciclo.",
        },
        {
          id: "focus_elsewhere",
          title: "Focar outro projeto",
          summary: "Comparar com outros projetos ativos antes de decidir.",
        },
      ];
      return buildCandidate({
        userId: options.userId,
        workspaceId: options.workspaceId,
        engineId: "project_recommender_v1",
        recommendationType: "PROJECT",
        title: `Atenção ao projeto: ${p.name}`,
        summary:
          p.description ||
          `Considerar o projeto ${p.name} no contexto atual — sem alterar o board.`,
        confidence: Math.min(85, 50 + (priority?.confidence ?? 20) / 3),
        impact: parseLevel(priority?.impact, "MEDIUM"),
        urgency: parseLevel(priority?.urgency, "MEDIUM"),
        effort: "MEDIUM",
        reversibility: "HIGH",
        evidence,
        limitations: [
          "Não cria, arquiva nem altera projetos.",
          "Não cria tarefas no Planner.",
        ],
        alternatives,
        reasoning: {
          whyAppeared: why,
          criteriaWeighted: ["completeness", "priority_link", "recency"],
          evidenceUsed: evidence.map((e) => e.summary),
          missingInformation: context.dataCompleteness.gaps.slice(0, 3),
          alternativesConsidered: alternatives.map((a) => a.title),
        },
        explanation:
          "Project Recommender sugere atenção a projetos existentes. Nunca altera o board.",
        criteriaContributed: ["completeness", "recency", "confidence"],
        missingData: context.dataCompleteness.gaps.slice(0, 2),
        fingerprint: fingerprintOf("project_recommender_v1", [p.id]),
        relatedProject: p.id,
        relatedPriority: priority?.id ?? null,
        relatedDecision: decision?.id ?? null,
        relatedDocumentIds: knowledge ? [knowledge.id] : [],
        relatedBusinessIds: p.businessId ? [p.businessId] : [],
        signalObservedAt: p.updatedAt ?? null,
        completenessScore: completeness,
        pipelineSteps: [
          "read_projects",
          "read_prioritization",
          "read_knowledge",
          "score_project",
          "attach_reasoning",
        ],
      });
    });
  },
};
