/**
 * Impact Prioritizer — ranks signals by impact. Never executes.
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
  parseLevel,
} from "@/lib/prioritization/engines/_helpers";
import type { PriorityEngine } from "@/lib/prioritization/types/types";

export const impactPrioritizer: PriorityEngine = {
  id: "impact_prioritizer_v1",
  kind: "IMPACT",
  label: "Priorizador de impacto",
  description:
    "Ordena o que merece atenção pelo impacto potencial — sem criar tarefas.",
  prioritize(context, options) {
    const max = options.max ?? 4;
    const completeness = context.dataCompleteness.score;

    const fromDiscoveries = context.sources.discoveries
      .filter(
        (d) =>
          !["REJECTED", "ARCHIVED", "DELETED", "SUPPRESSED"].includes(
            d.status ?? ""
          )
      )
      .map((d) => ({
        score: parseLevel(d.impact, "MEDIUM") === "HIGH" ? 3 : parseLevel(d.impact) === "MEDIUM" ? 2 : 1,
        d,
      }))
      .sort((a, b) => b.score - a.score || b.d.confidence - a.d.confidence);

    const out = fromDiscoveries.slice(0, max).map(({ d }, index) => {
      const project = context.sources.projects.find((p) =>
        ["active", "planning"].includes(p.status)
      );
      const decision = context.sources.decisions[0];
      return buildCandidate({
        userId: options.userId,
        workspaceId: options.workspaceId,
        engineId: "impact_prioritizer_v1",
        kind: "IMPACT",
        title: `Atenção por impacto: ${d.title}`,
        summary:
          d.summary ||
          "Sinal de alto impacto relativo — merece atenção humana, sem execução.",
        confidence: d.confidence,
        impact: parseLevel(d.impact, "HIGH"),
        urgency: parseLevel(d.urgency, "MEDIUM"),
        effort: "MEDIUM",
        reversibility: "MEDIUM",
        attentionReason: `Impacto ${d.impact ?? "MEDIUM"} ranqueado #${index + 1} entre discoveries.`,
        evidence: [
          makeEvidence({
            evidenceType: "impact_signal",
            sourceLayer: "discovery",
            sourceType: d.type,
            sourceId: d.id,
            summary: d.summary || d.title,
            confidence: d.confidence,
          }),
          ...(project
            ? [
                makeEvidence({
                  evidenceType: "project_context",
                  sourceLayer: "projects" as const,
                  sourceType: "project",
                  sourceId: project.id,
                  summary: project.name,
                  confidence: 55,
                }),
              ]
            : []),
        ],
        limitations: [
          "Sugestão de atenção apenas — não cria tarefas nem altera projetos.",
          "Impacto inferido de sinais read-only.",
          "Não implica ordem de execução.",
        ],
        alternativeViews: [
          {
            id: "alt_urgency",
            title: "Ver pela urgência",
            summary: "Pode haver itens mais urgentes com impacto menor.",
          },
          {
            id: "alt_defer",
            title: "Adiar atenção",
            summary: "Manter observação sem priorizar esta semana.",
          },
        ],
        explanation:
          "Impact Prioritizer eleva sinais de alto impacto. Responde 'o que merece atenção', nunca 'faça isto'.",
        criteriaContributed: ["impact", "confidence", "completeness"],
        missingData: context.dataCompleteness.gaps.slice(0, 3),
        fingerprint: fingerprintOf("impact_prioritizer_v1", [d.id]),
        relatedDiscovery: d.id,
        relatedProject: project?.id ?? null,
        relatedDecision: decision?.id ?? null,
        relatedMemoryIds: context.sources.memories.slice(0, 1).map((m) => m.id),
        signalObservedAt: d.updatedAt ?? null,
        completenessScore: completeness,
      });
    });

    if (!out.length && context.sources.decisions.length) {
      const dec = context.sources.decisions[0];
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          engineId: "impact_prioritizer_v1",
          kind: "IMPACT",
          title: `Atenção: decisão ${dec.title}`,
          summary: dec.summary,
          confidence: dec.confidence,
          impact: parseLevel(dec.impact, "MEDIUM"),
          urgency: parseLevel(dec.urgency, "LOW"),
          attentionReason: "Sem discovery dominante — decisão candidata a atenção por impacto.",
          evidence: [
            makeEvidence({
              evidenceType: "decision_signal",
              sourceLayer: "decision",
              sourceType: dec.kind,
              sourceId: dec.id,
              summary: dec.summary,
              confidence: dec.confidence,
            }),
          ],
          limitations: [
            "Poucos sinais de discovery.",
            "Somente atenção — sem execução.",
          ],
          alternativeViews: [
            {
              id: "alt_wait",
              title: "Aguardar discovery",
              summary: "Gerar mais descobertas antes de priorizar.",
            },
          ],
          explanation: "Fallback via Decision Support read-only.",
          criteriaContributed: ["impact", "confidence"],
          missingData: ["no_discoveries"],
          fingerprint: fingerprintOf("impact_prioritizer_v1", [dec.id, "dec"]),
          relatedDecision: dec.id,
          signalObservedAt: dec.updatedAt ?? null,
          completenessScore: completeness,
        })
      );
    }

    return out.slice(0, max);
  },
};
