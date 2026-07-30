/**
 * Review Engine — flags candidates that deserve human review.
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
} from "@/lib/decision-support/engines/_helpers";
import type { DecisionEngine } from "@/lib/decision-support/types/types";

const STALE_MS = 14 * 24 * 60 * 60 * 1000;

export const reviewEngine: DecisionEngine = {
  id: "review_v1",
  kind: "REVIEW",
  label: "Revisões sugeridas",
  description: 'Detecta situações do tipo "esta decisão merece revisão."',
  analyze(context, options) {
    const max = options.max ?? 4;
    const out = [];
    const now = Date.now();

    for (const p of context.sources.projects.filter((x) =>
      ["paused", "planning", "active"].includes(x.status)
    )) {
      const updated = p.updatedAt ? Date.parse(p.updatedAt) : NaN;
      const stale = !Number.isFinite(updated) || now - updated > STALE_MS;
      if (!stale && p.status !== "paused") continue;

      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          engineId: "review_v1",
          kind: "REVIEW",
          title: `Esta decisão merece revisão: ${p.name}`,
          summary:
            p.status === "paused"
              ? "Projeto pausado — revisar se a direção ainda faz sentido."
              : "Projeto sem atualização recente — candidato a revisão humana.",
          context: `Status: ${p.status}. Última atualização: ${p.updatedAt ?? "desconhecida"}.`,
          confidence: p.status === "paused" ? 68 : 55,
          impact: "MEDIUM",
          urgency: p.status === "paused" ? "MEDIUM" : "LOW",
          effort: "LOW",
          reversibility: "HIGH",
          evidence: [
            makeEvidence({
              evidenceType: "project_review_signal",
              sourceLayer: "projects",
              sourceType: "project",
              sourceId: p.id,
              summary: `${p.name} (${p.status})`,
              confidence: 60,
            }),
          ],
          limitations: [
            "Não altera o projeto.",
            "Não cria missão nem tarefa.",
            "Revisão é responsabilidade humana.",
          ],
          alternativeOptions: [
            {
              id: "keep",
              title: "Manter como está",
              summary: "Sem mudança de direção",
              pros: ["Continuidade"],
              cons: ["Risco de drift"],
            },
            {
              id: "reframe",
              title: "Reformular objetivo",
              summary: "Reescrever o porquê do projeto",
              pros: ["Clareza"],
              cons: ["Custo cognitivo"],
            },
          ],
          whyAppeared: `Projeto "${p.name}" apresenta sinal de estagnação ou pausa.`,
          explanation:
            "O Review Engine apenas marca candidatos a revisão humana.",
          fingerprint: fingerprintOf("review_v1", [p.id, "project_review"]),
          relatedProjectIds: [p.id],
          relatedBusinessIds: p.businessId ? [p.businessId] : [],
        })
      );
    }

    for (const d of context.sources.discoveries.filter(
      (x) => x.status === "PENDING_CONFIRMATION" || x.status === "GENERATED"
    )) {
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          engineId: "review_v1",
          kind: "REVIEW",
          title: `Revisar sinal: ${d.title}`,
          summary: "Discovery ainda não confirmada — merece revisão consciente.",
          context: `Tipo ${d.type} · status ${d.status ?? "n/a"} · confiança ${d.confidence}.`,
          confidence: Math.min(75, d.confidence),
          impact: "MEDIUM",
          urgency: "MEDIUM",
          effort: "LOW",
          reversibility: "HIGH",
          evidence: [
            makeEvidence({
              evidenceType: "discovery_pending",
              sourceLayer: "discovery",
              sourceType: d.type,
              sourceId: d.id,
              summary: d.summary || d.title,
              confidence: d.confidence,
            }),
          ],
          limitations: [
            "Não confirma nem rejeita discovery automaticamente.",
            "Apenas sugere revisão.",
          ],
          alternativeOptions: [
            {
              id: "confirm_later",
              title: "Adiar julgamento",
              summary: "Coletar mais contexto",
              pros: ["Mais evidência"],
              cons: ["Atraso"],
            },
          ],
          whyAppeared: `Discovery "${d.title}" permanece sem confirmação.`,
          explanation: "Sinais pendentes beneficiam de revisão humana explícita.",
          fingerprint: fingerprintOf("review_v1", [d.id, "disc_review"]),
          relatedDiscoveryIds: [d.id],
        })
      );
    }

    return out.slice(0, max);
  },
};
