/**
 * Stale Prioritizer — surfaces stale signals needing attention refresh.
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
  parseLevel,
} from "@/lib/prioritization/engines/_helpers";
import type { PriorityEngine } from "@/lib/prioritization/types/types";

const STALE_MS = 21 * 24 * 60 * 60 * 1000;

function isStale(updatedAt?: string): boolean {
  if (!updatedAt) return true;
  const t = new Date(updatedAt).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() - t >= STALE_MS;
}

export const stalePrioritizer: PriorityEngine = {
  id: "stale_prioritizer_v1",
  kind: "STALE",
  label: "Priorizador de sinais desatualizados",
  description:
    "Eleva itens estagnados ou antigos para renovar atenção — sem arquivar automaticamente.",
  prioritize(context, options) {
    const max = options.max ?? 4;
    const completeness = context.dataCompleteness.score;
    const out = [];

    for (const p of context.sources.projects
      .filter((x) => ["active", "paused", "planning"].includes(x.status))
      .filter((x) => isStale(x.updatedAt))
      .slice(0, max)) {
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          engineId: "stale_prioritizer_v1",
          kind: "STALE",
          title: `Atenção estagnada: ${p.name}`,
          summary:
            p.description ||
            "Projeto sem atualização recente — candidato a renovar atenção.",
          confidence: 48,
          impact: "MEDIUM",
          urgency: "LOW",
          effort: "LOW",
          reversibility: "HIGH",
          attentionReason: `Projeto "${p.name}" parece desatualizado (>21 dias).`,
          evidence: [
            makeEvidence({
              evidenceType: "stale_project",
              sourceLayer: "projects",
              sourceType: "project",
              sourceId: p.id,
              summary: `${p.name} · status ${p.status}`,
              confidence: 50,
            }),
          ],
          limitations: [
            "Não arquiva nem pausa o projeto.",
            "Recência baseada em updatedAt disponível.",
          ],
          alternativeViews: [
            {
              id: "alt_ok",
              title: "Estagnação aceitável",
              summary: "Manter como está sem elevar prioridade.",
            },
          ],
          explanation:
            "Stale Prioritizer destaca sinais frios. Nunca altera o projeto.",
          criteriaContributed: ["recency", "effort", "completeness"],
          missingData: context.dataCompleteness.gaps.slice(0, 2),
          fingerprint: fingerprintOf("stale_prioritizer_v1", ["proj", p.id]),
          relatedProject: p.id,
          relatedBusinessIds: p.businessId ? [p.businessId] : [],
          signalObservedAt: p.updatedAt ?? null,
          completenessScore: completeness,
        })
      );
    }

    for (const doc of context.sources.knowledgeDocuments
      .filter((d) => isStale(d.updatedAt))
      .slice(0, Math.max(0, max - out.length))) {
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          engineId: "stale_prioritizer_v1",
          kind: "STALE",
          title: `Knowledge desatualizado: ${doc.title}`,
          summary:
            doc.summary ||
            "Documento antigo — pode merecer revisão de relevância.",
          confidence: 40,
          impact: "LOW",
          urgency: "LOW",
          effort: "LOW",
          reversibility: "HIGH",
          attentionReason: `Documento "${doc.title}" sem atualização recente.`,
          evidence: [
            makeEvidence({
              evidenceType: "stale_knowledge",
              sourceLayer: "knowledge",
              sourceType: doc.type,
              sourceId: doc.id,
              summary: doc.title,
              confidence: 40,
            }),
          ],
          limitations: [
            "Não edita nem arquiva knowledge.",
            "Somente sugere atenção.",
          ],
          alternativeViews: [
            {
              id: "alt_archive_later",
              title: "Arquivar depois",
              summary: "Decisão humana futura — não automática.",
            },
          ],
          explanation:
            "Stale Prioritizer inclui knowledge frio na fila de atenção.",
          criteriaContributed: ["recency", "completeness"],
          missingData: [],
          fingerprint: fingerprintOf("stale_prioritizer_v1", ["know", doc.id]),
          relatedDocumentIds: [doc.id],
          signalObservedAt: doc.updatedAt ?? null,
          completenessScore: completeness,
        })
      );
    }

    for (const d of context.sources.decisions
      .filter((x) => isStale(x.updatedAt))
      .slice(0, Math.max(0, max - out.length))) {
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          engineId: "stale_prioritizer_v1",
          kind: "STALE",
          title: `Decisão antiga: ${d.title}`,
          summary: d.summary,
          confidence: Math.min(d.confidence, 45),
          impact: parseLevel(d.impact, "MEDIUM"),
          urgency: "LOW",
          attentionReason: `Decisão "${d.title}" sem revisão recente.`,
          evidence: [
            makeEvidence({
              evidenceType: "stale_decision",
              sourceLayer: "decision",
              sourceType: d.kind,
              sourceId: d.id,
              summary: d.summary,
              confidence: d.confidence,
            }),
          ],
          limitations: ["Não arquiva a decisão.", "Atenção apenas."],
          alternativeViews: [
            {
              id: "alt_keep",
              title: "Manter decisão",
              summary: "Sem nova revisão agora.",
            },
          ],
          explanation: "Decisões frias entram na fila via Stale Prioritizer.",
          criteriaContributed: ["recency", "confidence"],
          missingData: [],
          fingerprint: fingerprintOf("stale_prioritizer_v1", ["dec", d.id]),
          relatedDecision: d.id,
          signalObservedAt: d.updatedAt ?? null,
          completenessScore: completeness,
        })
      );
    }

    return out.slice(0, max);
  },
};
