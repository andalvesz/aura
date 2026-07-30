/**
 * Priority Engine — suggests priorities only. Never creates tasks or mutates projects.
 */

import {
  buildCandidate,
  fingerprintOf,
  makeEvidence,
} from "@/lib/decision-support/engines/_helpers";
import type { DecisionEngine } from "@/lib/decision-support/types/types";

export const priorityEngine: DecisionEngine = {
  id: "priority_v1",
  kind: "PRIORITY",
  label: "Prioridades sugeridas",
  description:
    "Organiza possíveis prioridades a partir de discovery, projetos e cognitivo — sem criar tarefas.",
  analyze(context, options) {
    const max = options.max ?? 4;
    const out = [];

    const activeProjects = context.sources.projects.filter((p) =>
      ["active", "planning", "idea"].includes(p.status)
    );
    const hotDiscoveries = context.sources.discoveries.filter(
      (d) =>
        d.confidence >= 40 &&
        !["REJECTED", "ARCHIVED", "DELETED", "SUPPRESSED"].includes(
          d.status ?? ""
        )
    );

    for (const d of hotDiscoveries.slice(0, max)) {
      const relatedProject = activeProjects[0];
      const evidence = [
        makeEvidence({
          evidenceType: "discovery_signal",
          sourceLayer: "discovery",
          sourceType: d.type,
          sourceId: d.id,
          summary: d.summary || d.title,
          confidence: d.confidence,
        }),
      ];
      if (relatedProject) {
        evidence.push(
          makeEvidence({
            evidenceType: "project_context",
            sourceLayer: "projects",
            sourceType: "project",
            sourceId: relatedProject.id,
            summary: relatedProject.name,
            confidence: 55,
          })
        );
      }
      for (const m of context.sources.memories.slice(0, 1)) {
        evidence.push(
          makeEvidence({
            evidenceType: "memory_context",
            sourceLayer: "memory",
            sourceType: "memory",
            sourceId: m.id,
            summary: m.title,
            confidence: m.confidence ?? 50,
          })
        );
      }

      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          engineId: "priority_v1",
          kind: "PRIORITY",
          title: `Prioridade sugerida: ${d.title}`,
          summary:
            d.summary ||
            "Sinal de discovery sugere atenção prioritária (sem execução).",
          context: relatedProject
            ? `Projeto relacionado: ${relatedProject.name}. Discovery ${d.type}.`
            : `Discovery ${d.type} com confiança ${d.confidence}.`,
          confidence: Math.min(90, d.confidence + 5),
          impact: (d.impact as "LOW" | "MEDIUM" | "HIGH") || "MEDIUM",
          urgency: (d.urgency as "LOW" | "MEDIUM" | "HIGH") || "MEDIUM",
          effort: "MEDIUM",
          reversibility: "HIGH",
          evidence,
          limitations: [
            "Sugestão apenas — não cria tarefas nem altera projetos.",
            "Baseada em sinais read-only do Brain.",
            "Não implica aprovação automática.",
          ],
          alternativeOptions: [
            {
              id: "alt_wait",
              title: "Aguardar mais evidências",
              summary: "Manter observação sem priorizar agora.",
              pros: ["Evita foco prematuro", "Reversível"],
              cons: ["Pode perder janela de atenção"],
            },
            {
              id: "alt_defer",
              title: "Revisar na próxima semana",
              summary: "Agendar revisão humana sem ação imediata.",
              pros: ["Ritmo sustentável"],
              cons: ["Atraso deliberado"],
            },
          ],
          whyAppeared: `Discovery "${d.title}" com confiança ${d.confidence} e sinais de impacto/urgência.`,
          explanation:
            "O Priority Engine ranqueia sinais existentes. Nenhuma tarefa ou mudança de projeto é criada.",
          fingerprint: fingerprintOf("priority_v1", [d.id, "priority"]),
          relatedDiscoveryIds: [d.id],
          relatedProjectIds: relatedProject ? [relatedProject.id] : [],
          relatedMemoryIds: context.sources.memories.slice(0, 1).map((m) => m.id),
        })
      );
    }

    if (!out.length && activeProjects.length) {
      const p = activeProjects[0];
      out.push(
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId,
          engineId: "priority_v1",
          kind: "PRIORITY",
          title: `Revisar foco: ${p.name}`,
          summary:
            "Projeto ativo sem discovery quente — candidato a revisão de prioridade.",
          context: `Status do projeto: ${p.status}.`,
          confidence: 42,
          impact: "MEDIUM",
          urgency: "LOW",
          effort: "LOW",
          reversibility: "HIGH",
          evidence: [
            makeEvidence({
              evidenceType: "project_active",
              sourceLayer: "projects",
              sourceType: "project",
              sourceId: p.id,
              summary: p.name,
              confidence: 50,
            }),
          ],
          limitations: [
            "Poucos sinais de discovery — confiança moderada/baixa.",
            "Sugestão apenas.",
          ],
          alternativeOptions: [
            {
              id: "alt_keep",
              title: "Manter foco atual",
              summary: "Não mudar prioridades.",
              pros: ["Estabilidade"],
              cons: ["Pode ignorar sinais fracos"],
            },
          ],
          whyAppeared: `Projeto "${p.name}" está ativo e pode merecer checagem de prioridade.`,
          explanation:
            "Sem discovery dominante, o motor sugere revisão de foco — sem alterar o projeto.",
          fingerprint: fingerprintOf("priority_v1", [p.id, "focus"]),
          relatedProjectIds: [p.id],
        })
      );
    }

    return out.slice(0, max);
  },
};
