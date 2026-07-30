/**
 * Tradeoff Engine — advantages, disadvantages, risks, uncertainties.
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
} from "@/lib/decision-support/engines/_helpers";
import type { DecisionEngine } from "@/lib/decision-support/types/types";

export const tradeoffEngine: DecisionEngine = {
  id: "tradeoff_v1",
  kind: "TRADEOFF",
  label: "Trade-offs",
  description:
    "Organiza vantagens, desvantagens, riscos e incertezas a partir de sinais existentes.",
  analyze(context, options) {
    const max = options.max ?? 3;
    const out = [];

    const risks = context.sources.discoveries.filter((d) =>
      ["RISK", "GAP", "STAGNATION"].includes(d.type)
    );
    const opps = context.sources.discoveries.filter((d) =>
      ["OPPORTUNITY"].includes(d.type)
    );

    const pairs = Math.min(max, Math.max(risks.length, opps.length, 1));
    for (let i = 0; i < pairs; i++) {
      const risk = risks[i];
      const opp = opps[i] ?? opps[0];
      const project = context.sources.projects[i] ?? context.sources.projects[0];
      if (!risk && !opp && !project) continue;

      const titleBase = opp?.title || risk?.title || project?.name || "cenário";
      const evidence = [];
      if (opp) {
        evidence.push(
          makeEvidence({
            evidenceType: "opportunity",
            sourceLayer: "discovery",
            sourceType: opp.type,
            sourceId: opp.id,
            summary: opp.summary || opp.title,
            confidence: opp.confidence,
          })
        );
      }
      if (risk) {
        evidence.push(
          makeEvidence({
            evidenceType: "risk",
            sourceLayer: "discovery",
            sourceType: risk.type,
            sourceId: risk.id,
            summary: risk.summary || risk.title,
            confidence: risk.confidence,
          })
        );
      }
      if (project) {
        evidence.push(
          makeEvidence({
            evidenceType: "project",
            sourceLayer: "projects",
            sourceType: "project",
            sourceId: project.id,
            summary: project.name,
            confidence: 50,
          })
        );
      }

      const advantages = [
        opp
          ? `Oportunidade: ${opp.title}`
          : "Possível ganho de clareza ao comparar cenários",
        project ? `Alinhamento com projeto ${project.name}` : "Exploração estruturada",
      ];
      const disadvantages = [
        risk
          ? `Risco/gap: ${risk.title}`
          : "Custo de atenção e possível over-analysis",
        "Pode atrasar progresso se o trade-off for interminável",
      ];
      const riskList = [
        risk?.summary || "Incerteza residual nos sinais de discovery",
        "Confiança limitada pelos dados disponíveis",
      ];
      const uncertainties = [
        ...context.dataCompleteness.gaps.slice(0, 3).map((g) => `Lacuna: ${g}`),
        "Impacto real depende de contexto humano não capturado",
      ];

      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          engineId: "tradeoff_v1",
          kind: "TRADEOFF",
          title: `Trade-off: ${titleBase}`,
          summary:
            "Comparação de vantagens, desvantagens, riscos e incertezas (sem decidir por você).",
          context: project
            ? `Contexto de projeto: ${project.name} (${project.status}).`
            : "Contexto a partir de discovery e conhecimento do workspace.",
          confidence: Math.round(
            ((opp?.confidence ?? 40) + (risk?.confidence ?? 40)) / 2
          ),
          impact: "MEDIUM",
          urgency: "MEDIUM",
          effort: "MEDIUM",
          reversibility: "HIGH",
          evidence,
          limitations: [
            "Não escolhe um lado automaticamente.",
            "Não executa ações nem altera planos.",
            "Trade-off incompleto se faltarem evidências.",
          ],
          alternativeOptions: [
            {
              id: "pursue_opp",
              title: "Explorar a oportunidade",
              summary: opp?.summary || "Seguir o sinal positivo",
              pros: advantages.slice(0, 2),
              cons: disadvantages.slice(0, 2),
            },
            {
              id: "mitigate_risk",
              title: "Mitigar o risco primeiro",
              summary: risk?.summary || "Reduzir incerteza antes de avançar",
              pros: ["Reduz exposição", "Mais informação"],
              cons: ["Pode perder momentum"],
            },
            {
              id: "hold",
              title: "Manter status quo",
              summary: "Não agir até nova evidência",
              pros: ["Conservador", "Reversível"],
              cons: ["Estagnação possível"],
            },
          ],
          whyAppeared:
            "Há sinais concorrentes (oportunidade vs risco/gap) que merecem comparação explícita.",
          explanation:
            "O Tradeoff Engine organiza prós/contras a partir de evidências read-only.",
          fingerprint: fingerprintOf("tradeoff_v1", [
            opp?.id ?? "no-opp",
            risk?.id ?? "no-risk",
            project?.id ?? "no-proj",
          ]),
          relatedDiscoveryIds: [opp?.id, risk?.id].filter(Boolean) as string[],
          relatedProjectIds: project ? [project.id] : [],
          tradeoff: {
            advantages,
            disadvantages,
            risks: riskList,
            uncertainties,
          },
        })
      );
    }

    return out.slice(0, max);
  },
};
