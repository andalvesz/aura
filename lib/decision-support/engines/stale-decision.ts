/**
 * Stale Decision Detector — old knowledge / weak cognitive signals.
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
} from "@/lib/decision-support/engines/_helpers";
import type { DecisionEngine } from "@/lib/decision-support/types/types";

const STALE_DOC_MS = 30 * 24 * 60 * 60 * 1000;

export const staleDecisionEngine: DecisionEngine = {
  id: "stale_decision_v1",
  kind: "STALE",
  label: "Decisões / sinais antigos",
  description: "Detecta conhecimento ou sinais que podem estar desatualizados.",
  analyze(context, options) {
    const max = options.max ?? 4;
    const out = [];
    const now = Date.now();

    for (const doc of context.sources.knowledgeDocuments) {
      const updated = doc.updatedAt ? Date.parse(doc.updatedAt) : NaN;
      if (!Number.isFinite(updated) || now - updated < STALE_DOC_MS) continue;
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          engineId: "stale_decision_v1",
          kind: "STALE",
          title: `Conhecimento possivelmente desatualizado: ${doc.title}`,
          summary:
            "Documento antigo pode sustentar decisões com premissas expiradas.",
          context: `Última atualização: ${doc.updatedAt}. Tipo: ${doc.type}.`,
          confidence: 58,
          impact: "MEDIUM",
          urgency: "LOW",
          effort: "LOW",
          reversibility: "HIGH",
          evidence: [
            makeEvidence({
              evidenceType: "stale_knowledge",
              sourceLayer: "knowledge",
              sourceType: doc.type,
              sourceId: doc.id,
              summary: doc.title,
              confidence: 55,
            }),
          ],
          limitations: [
            "Não arquiva nem edita o documento.",
            "Idade ≠ invalidade automática.",
          ],
          alternativeOptions: [
            {
              id: "refresh",
              title: "Revisar documento",
              summary: "Atualizar ou confirmar validade",
              pros: ["Premissas frescas"],
              cons: ["Esforço"],
            },
            {
              id: "keep",
              title: "Manter como referência",
              summary: "Aceitar como histórico",
              pros: ["Sem custo"],
              cons: ["Risco de premissa velha"],
            },
          ],
          whyAppeared: `Documento "${doc.title}" não é atualizado há mais de ~30 dias.`,
          explanation:
            "Stale Decision Detector alerta para premissas potencialmente expiradas.",
          fingerprint: fingerprintOf("stale_decision_v1", [doc.id, "doc"]),
          relatedDocumentIds: [doc.id],
        })
      );
    }

    for (const art of context.sources.cognitiveArtifacts.filter(
      (a) => a.confidence < 45 && (a.status === "GENERATED" || !a.status)
    )) {
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          engineId: "stale_decision_v1",
          kind: "STALE",
          title: `Sinal cognitivo fraco: ${art.title}`,
          summary:
            "Artefato cognitivo com baixa confiança — evitar decisões firmes com base nele.",
          context: art.summary,
          confidence: Math.max(35, art.confidence),
          impact: "LOW",
          urgency: "LOW",
          effort: "LOW",
          reversibility: "HIGH",
          evidence: [
            makeEvidence({
              evidenceType: "weak_cognitive",
              sourceLayer: "cognitive",
              sourceType: art.artifactType ?? "artifact",
              sourceId: art.id,
              summary: art.summary || art.title,
              confidence: art.confidence,
            }),
          ],
          limitations: [
            "Não rejeita o artefato cognitivo.",
            "Apenas recomenda cautela.",
          ],
          alternativeOptions: [
            {
              id: "seek_evidence",
              title: "Buscar mais evidências",
              summary: "Fortalecer ou descartar o sinal",
              pros: ["Mais certeza"],
              cons: ["Tempo"],
            },
          ],
          whyAppeared: `Artefato "${art.title}" com confiança ${art.confidence}.`,
          explanation: "Sinais fracos não devem ancorar decisões fortes.",
          fingerprint: fingerprintOf("stale_decision_v1", [art.id, "cog"]),
        })
      );
    }

    return out.slice(0, max);
  },
};
