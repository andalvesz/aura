/**
 * Learning Recommendation — suggests knowledge/cognitive learning focus.
 * Never creates courses or tasks.
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
} from "@/lib/recommendation/engines/_helpers";
import type { RecommendationEngine } from "@/lib/recommendation/types/types";

export const learningRecommender: RecommendationEngine = {
  id: "learning_recommender_v1",
  recommendationType: "LEARNING",
  label: "Recomendador de aprendizado",
  description:
    "Sugere lacunas de conhecimento ou insights a revisar — sem criar tarefas.",
  recommend(context, options) {
    const max = options.max ?? 4;
    const completeness = context.dataCompleteness.score;

    const docs = context.sources.knowledgeDocuments.slice(0, max);
    const insights = context.sources.cognitiveArtifacts
      .filter((a) =>
        ["INSIGHT", "PATTERN", "HYPOTHESIS"].includes(a.artifactType ?? "")
      )
      .slice(0, max);

    const combined = [
      ...docs.map((d) => ({ kind: "doc" as const, d })),
      ...insights.map((a) => ({ kind: "insight" as const, a })),
    ].slice(0, max);

    if (!combined.length && context.sources.identityHints.length) {
      const hint = context.sources.identityHints[0];
      const evidence = [
        makeEvidence({
          evidenceType: "identity_gap",
          sourceLayer: "identity",
          sourceType: "hint",
          sourceId: hint.id,
          summary: hint.summary || hint.title,
          confidence: 40,
        }),
      ];
      const alternatives = [
        {
          id: "skip_learning",
          title: "Adiar aprendizado",
          summary: "Focar em execução humana fora do Aura.",
        },
      ];
      return [
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          engineId: "learning_recommender_v1",
          recommendationType: "LEARNING",
          title: `Revisar identidade: ${hint.title}`,
          summary:
            "Há pouco material de conhecimento — considerar revisar claims de identidade.",
          confidence: 40,
          impact: "LOW",
          urgency: "LOW",
          effort: "LOW",
          reversibility: "HIGH",
          evidence,
          limitations: [
            "Não cria planos de estudo.",
            "Não altera Identity nem Memory.",
          ],
          alternatives,
          reasoning: {
            whyAppeared: "Poucos documentos/insights disponíveis no contexto.",
            criteriaWeighted: ["completeness", "identity"],
            evidenceUsed: evidence.map((e) => e.summary),
            missingInformation: ["no_knowledge", "no_cognitive_artifacts"],
            alternativesConsidered: alternatives.map((a) => a.title),
          },
          explanation:
            "Learning Recommender aponta lacunas. Nunca cria tarefas de estudo.",
          criteriaContributed: ["completeness"],
          missingData: context.dataCompleteness.gaps.slice(0, 3),
          fingerprint: fingerprintOf("learning_recommender_v1", [hint.id]),
          signalObservedAt: null,
          completenessScore: completeness,
          pipelineSteps: ["read_identity", "detect_gap", "attach_reasoning"],
        }),
      ];
    }

    return combined.map((item, index) => {
      if (item.kind === "doc") {
        const d = item.d;
        const evidence = [
          makeEvidence({
            evidenceType: "knowledge_doc",
            sourceLayer: "knowledge",
            sourceType: d.type,
            sourceId: d.id,
            summary: d.summary || d.title,
            confidence: 55,
          }),
          ...context.sources.memories.slice(0, 1).map((m) =>
            makeEvidence({
              evidenceType: "memory_link",
              sourceLayer: "memory",
              sourceType: "memory",
              sourceId: m.id,
              summary: m.title,
              confidence: m.confidence ?? 50,
            })
          ),
        ];
        const alternatives = [
          {
            id: "defer_doc",
            title: "Adiar revisão",
            summary: "Revisar este documento em outro ciclo.",
          },
          {
            id: "prefer_insight",
            title: "Preferir insight cognitivo",
            summary: "Priorizar artefatos cognitivos se existirem.",
          },
        ];
        return buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          engineId: "learning_recommender_v1",
          recommendationType: "LEARNING",
          title: `Revisar conhecimento: ${d.title}`,
          summary:
            d.summary ||
            "Documento sugerido para revisão humana — sem criar tarefa.",
          confidence: 55,
          impact: "MEDIUM",
          urgency: "LOW",
          effort: "LOW",
          reversibility: "HIGH",
          evidence,
          limitations: [
            "Não cria tarefas de estudo.",
            "Não altera Knowledge Hub.",
          ],
          alternatives,
          reasoning: {
            whyAppeared: `Documento #${index + 1} no radar de aprendizado.`,
            criteriaWeighted: ["recency", "completeness", "confidence"],
            evidenceUsed: evidence.map((e) => e.summary),
            missingInformation: context.dataCompleteness.gaps.slice(0, 3),
            alternativesConsidered: alternatives.map((a) => a.title),
          },
          explanation:
            "Learning Recommender sugere revisão de conhecimento. Nunca executa.",
          criteriaContributed: ["recency", "completeness"],
          missingData: context.dataCompleteness.gaps.slice(0, 2),
          fingerprint: fingerprintOf("learning_recommender_v1", ["doc", d.id]),
          relatedDocumentIds: [d.id],
          relatedMemoryIds: context.sources.memories.slice(0, 1).map((m) => m.id),
          signalObservedAt: d.updatedAt ?? null,
          completenessScore: completeness,
          pipelineSteps: [
            "read_knowledge",
            "read_memory",
            "score_learning",
            "attach_reasoning",
          ],
        });
      }

      const a = item.a;
      const evidence = [
        makeEvidence({
          evidenceType: "cognitive_insight",
          sourceLayer: "cognitive",
          sourceType: a.artifactType ?? "INSIGHT",
          sourceId: a.id,
          summary: a.summary || a.title,
          confidence: a.confidence,
        }),
      ];
      const alternatives = [
        {
          id: "defer_insight",
          title: "Adiar insight",
          summary: "Revisitar em outro momento.",
        },
      ];
      return buildCandidate({
        userId: options.userId,
        workspaceId: options.workspaceId,
        engineId: "learning_recommender_v1",
        recommendationType: "LEARNING",
        title: `Revisar insight: ${a.title}`,
        summary: a.summary || "Insight sugerido para reflexão humana.",
        confidence: a.confidence,
        impact: "MEDIUM",
        urgency: "LOW",
        effort: "LOW",
        reversibility: "HIGH",
        evidence,
        limitations: [
          "Não promove insights automaticamente.",
          "Não altera Cognitive Kernel.",
        ],
        alternatives,
        reasoning: {
          whyAppeared: `Insight cognitivo #${index + 1} candidato a revisão.`,
          criteriaWeighted: ["confidence", "completeness"],
          evidenceUsed: evidence.map((e) => e.summary),
          missingInformation: context.dataCompleteness.gaps.slice(0, 3),
          alternativesConsidered: alternatives.map((a) => a.title),
        },
        explanation:
          "Learning Recommender sugere revisão de insights. Nunca promove artefatos.",
        criteriaContributed: ["confidence"],
        missingData: context.dataCompleteness.gaps.slice(0, 2),
        fingerprint: fingerprintOf("learning_recommender_v1", [
          "insight",
          a.id,
        ]),
        signalObservedAt: null,
        completenessScore: completeness,
        pipelineSteps: [
          "read_cognitive",
          "score_learning",
          "attach_reasoning",
        ],
      });
    });
  },
};
