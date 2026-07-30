/**
 * What-If engine — generates a comparable set of scenario branches for a prompt.
 */

import {
  baseTimeline,
  buildScenarioCandidate,
  fingerprintOf,
  makeEvidence,
} from "@/lib/scenario/engines/_helpers";
import {
  newScenarioId,
  type ScenarioEngine,
  type ScenarioType,
} from "@/lib/scenario/types/types";

const BRANCHES: Array<{
  type: ScenarioType;
  label: string;
  impact: "LOW" | "MEDIUM" | "HIGH";
  confAdj: number;
}> = [
  { type: "MOST_LIKELY", label: "Mais provável", impact: "MEDIUM", confAdj: 5 },
  { type: "BEST_CASE", label: "Melhor caso", impact: "HIGH", confAdj: 8 },
  { type: "WORST_CASE", label: "Pior caso", impact: "HIGH", confAdj: -4 },
  { type: "CONSERVATIVE", label: "Conservador", impact: "LOW", confAdj: 0 },
];

export const whatIfEngine: ScenarioEngine = {
  id: "what_if_v1",
  scenarioType: "WHAT_IF",
  label: "E se…",
  description:
    'Gera ramos comparáveis para perguntas do tipo "E se iniciarmos / adiarmos / investirmos…".',
  simulate(context, options) {
    const prompt =
      options.whatIfPrompt?.trim() ||
      context.whatIfPrompt?.trim() ||
      "E se iniciarmos este projeto?";
    const max = options.max ?? 4;
    const project =
      context.sources.projects.find((p) => p.id === options.relatedProjectId) ??
      context.sources.projects[0];
    const decision =
      context.sources.decisions.find((d) => d.id === options.relatedDecisionId) ??
      context.sources.decisions[0];

    const sharedEvidence: ReturnType<typeof makeEvidence>[] = [];
    if (project) {
      sharedEvidence.push(
        makeEvidence({
          evidenceType: "what_if_project",
          sourceLayer: "projects",
          sourceType: "project",
          sourceId: project.id,
          summary: project.name,
          confidence: 60,
        })
      );
    }
    if (decision) {
      sharedEvidence.push(
        makeEvidence({
          evidenceType: "what_if_decision",
          sourceLayer: "decision",
          sourceType: decision.kind,
          sourceId: decision.id,
          summary: decision.title,
          confidence: decision.confidence,
        })
      );
    }
    for (const d of context.sources.discoveries.slice(0, 2)) {
      sharedEvidence.push(
        makeEvidence({
          evidenceType: "what_if_discovery",
          sourceLayer: "discovery",
          sourceType: d.type,
          sourceId: d.id,
          summary: d.title,
          confidence: d.confidence,
        })
      );
    }
    if (!sharedEvidence.length) {
      sharedEvidence.push(
        makeEvidence({
          evidenceType: "what_if_thin",
          sourceLayer: "scenario",
          sourceType: "prompt",
          sourceId: context.correlationId,
          summary: prompt,
          confidence: 40,
        })
      );
    }

    return BRANCHES.slice(0, max).map((branch) =>
      buildScenarioCandidate({
        userId: options.userId,
        workspaceId: options.workspaceId,
        engineId: "what_if_v1",
        scenarioType: branch.type,
        title: `${branch.label}: ${prompt.slice(0, 72)}`,
        description: `Ramo hipotético "${branch.label}" para a pergunta What-If. O Aura apenas descreve o que pode acontecer — nunca manda fazer.`,
        context: project
          ? `Âncora: projeto ${project.name}. Pergunta: ${prompt}`
          : `Pergunta: ${prompt}`,
        confidence: Math.round(
          48 + branch.confAdj + context.dataCompleteness.score * 0.2
        ),
        impact: branch.impact,
        assumptions: [
          {
            id: newScenarioId("asm"),
            statement: `What-If: ${prompt}`,
            confidence: 60,
            source: "user_prompt",
          },
          {
            id: newScenarioId("asm"),
            statement: `Ramo ${branch.label} é uma hipótese, não uma recomendação de execução.`,
            confidence: 100,
            source: "policy",
          },
        ],
        limitations: [
          "Hipotético — sem execução.",
          "Não altera Planner, projetos ou Decision Support.",
          "Sem valores financeiros automáticos.",
          "Comparável apenas relativamente a outros ramos.",
        ],
        evidence: sharedEvidence,
        alternativeScenarios: BRANCHES.filter((b) => b.type !== branch.type).map(
          (b) => ({
            id: `alt_${b.type}`,
            title: b.label,
            scenarioType: b.type,
            summary: `Alternativa What-If: ${b.label}`,
          })
        ),
        relatedDecisionId: decision?.id ?? null,
        relatedProjectId: project?.id ?? null,
        relatedDiscoveryId: context.sources.discoveries[0]?.id ?? null,
        relatedBusinessId: project?.businessId ?? null,
        relatedDocumentIds: context.sources.knowledgeDocuments
          .slice(0, 2)
          .map((d) => d.id),
        relatedMemoryIds: context.sources.memories.slice(0, 2).map((m) => m.id),
        whatIfPrompt: prompt,
        ignoredData: [
          ...context.dataCompleteness.gaps.map((g) => `gap:${g}`),
          "ordens de execução",
          "automações",
        ],
        whyResult: `Para "${prompt}", o ramo ${branch.label} organiza evidências read-only e deixa explícitas hipóteses e lacunas — sem mandar agir.`,
        timeline: baseTimeline(prompt),
        uncertainty: {
          hypotheses: [`What-If: ${prompt}`, `Desfecho relativo: ${branch.label}`],
          missingData: context.dataCompleteness.gaps,
          limitations: [
            "Não é previsão absoluta.",
            "Depende de premissas humanas.",
          ],
        },
        fingerprint: fingerprintOf("what_if_v1", [
          branch.type,
          prompt.slice(0, 50),
          project?.id ?? "np",
        ]),
      })
    );
  },
};
