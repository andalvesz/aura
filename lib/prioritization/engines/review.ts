/**
 * Review Prioritizer — surfaces items that deserve human review attention.
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
  parseLevel,
} from "@/lib/prioritization/engines/_helpers";
import type { PriorityEngine } from "@/lib/prioritization/types/types";

export const reviewPrioritizer: PriorityEngine = {
  id: "review_prioritizer_v1",
  kind: "REVIEW",
  label: "Priorizador de revisão",
  description:
    "Sugere o que merece revisão humana — sem forçar decisões.",
  prioritize(context, options) {
    const max = options.max ?? 4;
    const completeness = context.dataCompleteness.score;
    const out = [];

    for (const d of context.sources.decisions
      .filter((x) =>
        ["SUGGESTED", "NEEDS_REVIEW", "ACCEPTED"].includes(x.status ?? "SUGGESTED")
      )
      .slice(0, max)) {
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          engineId: "review_prioritizer_v1",
          kind: "REVIEW",
          title: `Revisar: ${d.title}`,
          summary: d.summary || "Decisão candidata a revisão de atenção.",
          confidence: Math.max(35, d.confidence - 5),
          impact: parseLevel(d.impact, "MEDIUM"),
          urgency: parseLevel(d.urgency, "MEDIUM"),
          effort: "LOW",
          reversibility: "HIGH",
          attentionReason: `Decisão "${d.title}" no status ${d.status ?? "SUGGESTED"} merece checagem.`,
          evidence: [
            makeEvidence({
              evidenceType: "decision_review",
              sourceLayer: "decision",
              sourceType: d.kind,
              sourceId: d.id,
              summary: d.summary,
              confidence: d.confidence,
            }),
          ],
          limitations: [
            "Revisão sugerida — não altera o status da decisão automaticamente além do feedback auditável.",
            "Sem execução.",
          ],
          alternativeViews: [
            {
              id: "alt_skip",
              title: "Adiar revisão",
              summary: "Revisitar na próxima semana.",
            },
          ],
          explanation:
            "Review Prioritizer eleva decisões/cenários para atenção de revisão humana.",
          criteriaContributed: ["confidence", "effort", "recency"],
          missingData: context.dataCompleteness.gaps.slice(0, 2),
          fingerprint: fingerprintOf("review_prioritizer_v1", ["dec", d.id]),
          relatedDecision: d.id,
          signalObservedAt: d.updatedAt ?? null,
          completenessScore: completeness,
        })
      );
    }

    for (const s of context.sources.scenarios
      .filter((x) => ["DRAFT", "SAVED", "COMPARED"].includes(x.status ?? "DRAFT"))
      .slice(0, Math.max(0, max - out.length))) {
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          engineId: "review_prioritizer_v1",
          kind: "REVIEW",
          title: `Revisar cenário: ${s.title}`,
          summary:
            s.description ||
            "Cenário candidato a revisão de premissas — sem simular de novo automaticamente.",
          confidence: s.confidence,
          impact: parseLevel(s.impact, "MEDIUM"),
          urgency: "LOW",
          effort: "LOW",
          reversibility: "HIGH",
          attentionReason: `Cenário "${s.title}" pode merecer revisão de premissas.`,
          evidence: [
            makeEvidence({
              evidenceType: "scenario_review",
              sourceLayer: "scenario",
              sourceType: "scenario",
              sourceId: s.id,
              summary: s.title,
              confidence: s.confidence,
            }),
          ],
          limitations: [
            "Não re-simula nem executa ramos.",
            "Atenção apenas.",
          ],
          alternativeViews: [
            {
              id: "alt_keep",
              title: "Manter cenário como está",
              summary: "Sem nova revisão agora.",
            },
          ],
          explanation:
            "Review Prioritizer inclui cenários read-only na fila de atenção.",
          criteriaContributed: ["confidence", "completeness"],
          missingData: context.dataCompleteness.gaps.slice(0, 2),
          fingerprint: fingerprintOf("review_prioritizer_v1", ["scn", s.id]),
          relatedScenario: s.id,
          signalObservedAt: s.updatedAt ?? null,
          completenessScore: completeness,
        })
      );
    }

    if (!out.length && context.sources.cognitiveArtifacts.length) {
      const a = context.sources.cognitiveArtifacts[0];
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          engineId: "review_prioritizer_v1",
          kind: "REVIEW",
          title: `Revisar insight: ${a.title}`,
          summary: a.summary,
          confidence: a.confidence,
          impact: "LOW",
          urgency: "LOW",
          attentionReason: "Artefato cognitivo disponível para revisão humana.",
          evidence: [
            makeEvidence({
              evidenceType: "cognitive_review",
              sourceLayer: "cognitive",
              sourceType: a.artifactType ?? "artifact",
              sourceId: a.id,
              summary: a.summary,
              confidence: a.confidence,
            }),
          ],
          limitations: ["Kernel cognitivo não é alterado.", "Somente leitura."],
          alternativeViews: [
            {
              id: "alt_ignore",
              title: "Ignorar insight",
              summary: "Não elevar à fila de prioridades.",
            },
          ],
          explanation: "Fallback de revisão via Cognitive read-only.",
          criteriaContributed: ["confidence"],
          missingData: ["no_decisions", "no_scenarios"],
          fingerprint: fingerprintOf("review_prioritizer_v1", ["cog", a.id]),
          completenessScore: completeness,
        })
      );
    }

    return out.slice(0, max);
  },
};
