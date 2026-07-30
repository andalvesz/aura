/**
 * Risk Ranking Engine — ranks risk-like signals.
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
  LEVEL_SCORE,
} from "@/lib/decision-support/engines/_helpers";
import type { DecisionEngine } from "@/lib/decision-support/types/types";

export const riskRankingEngine: DecisionEngine = {
  id: "risk_ranking_v1",
  kind: "RISK",
  label: "Ranking de riscos",
  description: "Ordena riscos candidatos para atenção humana.",
  analyze(context, options) {
    const max = options.max ?? 5;
    const scored = context.sources.discoveries
      .filter(
        (d) =>
          ["RISK", "DEPENDENCY", "STAGNATION"].includes(d.type) &&
          !["REJECTED", "ARCHIVED", "SUPPRESSED"].includes(d.status ?? "")
      )
      .map((d) => {
        const impact = LEVEL_SCORE[(d.impact as "LOW" | "MEDIUM" | "HIGH") || "MEDIUM"];
        const urgency = LEVEL_SCORE[(d.urgency as "LOW" | "MEDIUM" | "HIGH") || "MEDIUM"];
        const score = d.confidence * 0.45 + impact * 18 + urgency * 12;
        return { d, score };
      })
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, max).map(({ d, score }, index) =>
      buildCandidate({
        userId: options.userId,
        workspaceId: options.workspaceId,
        engineId: "risk_ranking_v1",
        kind: "RISK",
        title: `#${index + 1} Risco: ${d.title}`,
        summary: d.summary || "Risco ranqueado para consideração (sem mitigação automática).",
        context: `Rank score ≈ ${Math.round(score)}. Tipo discovery: ${d.type}.`,
        confidence: d.confidence,
        impact: (d.impact as "LOW" | "MEDIUM" | "HIGH") || "HIGH",
        urgency: (d.urgency as "LOW" | "MEDIUM" | "HIGH") || "MEDIUM",
        effort: "MEDIUM",
        reversibility: "LOW",
        evidence: [
          makeEvidence({
            evidenceType: "ranked_risk",
            sourceLayer: "discovery",
            sourceType: d.type,
            sourceId: d.id,
            summary: d.summary || d.title,
            confidence: d.confidence,
          }),
        ],
        limitations: [
          "Não mitiga riscos automaticamente.",
          "Não altera projetos nem cria alertas de execução.",
        ],
        alternativeOptions: [
          {
            id: "monitor",
            title: "Apenas monitorar",
            summary: "Observar sem ação",
            pros: ["Baixo esforço"],
            cons: ["Risco pode materializar"],
          },
          {
            id: "investigate",
            title: "Investigar",
            summary: "Buscar mais evidências",
            pros: ["Reduz incerteza"],
            cons: ["Custo de tempo"],
          },
        ],
        whyAppeared: `Risco/sinal "${d.title}" ranqueado na posição ${index + 1}.`,
        explanation:
          "Risk Ranking prioriza atenção humana; não executa mitigações.",
        fingerprint: fingerprintOf("risk_ranking_v1", [d.id]),
        relatedDiscoveryIds: [d.id],
        relatedEntityIds: context.sources.worldEntities.slice(0, 1).map((e) => e.id),
      })
    );
  },
};
