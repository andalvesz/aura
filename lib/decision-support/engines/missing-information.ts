/**
 * Missing Information Engine — "Faltam informações para decidir."
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
} from "@/lib/decision-support/engines/_helpers";
import type { DecisionEngine } from "@/lib/decision-support/types/types";

export const missingInformationEngine: DecisionEngine = {
  id: "missing_information_v1",
  kind: "MISSING_INFO",
  label: "Informações faltantes",
  description: "Detecta ausência de dados necessários para uma decisão consciente.",
  analyze(context, options) {
    const max = options.max ?? 4;
    const out = [];
    const gaps = context.dataCompleteness.gaps;

    if (gaps.length) {
      const evidence = [
        makeEvidence({
          evidenceType: "completeness_gap",
          sourceLayer: "decision",
          sourceType: "data_completeness",
          sourceId: context.correlationId,
          summary: `Score ${context.dataCompleteness.score}/100 · gaps: ${gaps.join(", ")}`,
          confidence: 80,
        }),
      ];
      for (const p of context.sources.projects.slice(0, 1)) {
        evidence.push(
          makeEvidence({
            evidenceType: "project_needs_data",
            sourceLayer: "projects",
            sourceType: "project",
            sourceId: p.id,
            summary: p.name,
            confidence: 50,
          })
        );
      }

      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          engineId: "missing_information_v1",
          kind: "MISSING_INFO",
          title: "Faltam informações para decidir",
          summary: `Completude ${context.dataCompleteness.score}/100. Lacunas: ${gaps.join(", ")}.`,
          context:
            "O Brain não tem cobertura suficiente em uma ou mais camadas para apoiar uma decisão sólida.",
          confidence: Math.max(40, 100 - context.dataCompleteness.score),
          impact: "MEDIUM",
          urgency: "MEDIUM",
          effort: "MEDIUM",
          reversibility: "HIGH",
          evidence,
          limitations: [
            "Não preenche lacunas automaticamente.",
            "Não inventa dados ausentes.",
            "Sugestão de coleta — sem execução.",
          ],
          alternativeOptions: [
            {
              id: "capture",
              title: "Capturar mais contexto",
              summary: "Adicionar memórias, docs ou discovery feedback",
              pros: ["Melhora confiança futura"],
              cons: ["Esforço imediato"],
            },
            {
              id: "decide_anyway",
              title: "Decidir com incerteza explícita",
              summary: "Aceitar limitações conscientemente",
              pros: ["Velocidade"],
              cons: ["Maior risco de erro"],
            },
          ],
          whyAppeared: `Lacunas detectadas: ${gaps.join(", ")}.`,
          explanation:
            "Missing Information Engine bloqueia falsa certeza quando faltam fontes.",
          fingerprint: fingerprintOf("missing_information_v1", [
            gaps.sort().join(","),
          ]),
          relatedProjectIds: context.sources.projects.slice(0, 1).map((p) => p.id),
        })
      );
    }

    for (const p of context.sources.projects.filter(
      (x) => !x.description || x.description.trim().length < 8
    )) {
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          engineId: "missing_information_v1",
          kind: "MISSING_INFO",
          title: `Falta descrição: ${p.name}`,
          summary:
            "Projeto sem descrição suficiente — difícil apoiar decisões de foco.",
          context: `Projeto ${p.name} (${p.status}) com metadados incompletos.`,
          confidence: 60,
          impact: "LOW",
          urgency: "LOW",
          effort: "LOW",
          reversibility: "HIGH",
          evidence: [
            makeEvidence({
              evidenceType: "thin_project",
              sourceLayer: "projects",
              sourceType: "project",
              sourceId: p.id,
              summary: p.name,
              confidence: 55,
            }),
          ],
          limitations: ["Não edita o projeto.", "Apenas aponta a lacuna."],
          alternativeOptions: [
            {
              id: "enrich",
              title: "Enriquecer descrição",
              summary: "Adicionar contexto manualmente",
              pros: ["Melhor suporte futuro"],
              cons: ["Tempo"],
            },
          ],
          whyAppeared: `Projeto "${p.name}" tem descrição insuficiente.`,
          explanation: "Metadados fracos reduzem qualidade do apoio à decisão.",
          fingerprint: fingerprintOf("missing_information_v1", [
            p.id,
            "thin_desc",
          ]),
          relatedProjectIds: [p.id],
        })
      );
    }

    return out.slice(0, max);
  },
};
