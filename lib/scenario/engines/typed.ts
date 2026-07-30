/**
 * Typed scenario engines — Best/Worst/Most Likely/Optimistic/Conservative/Neutral.
 */

import {
  baseTimeline,
  buildScenarioCandidate,
  fingerprintOf,
  makeEvidence,
} from "@/lib/scenario/engines/_helpers";
import {
  newScenarioId,
  SCENARIO_TYPE_LABELS,
  type ScenarioEngine,
  type ScenarioEngineId,
  type ScenarioImpact,
  type ScenarioType,
} from "@/lib/scenario/types/types";

type TypeProfile = {
  id: ScenarioEngineId;
  scenarioType: ScenarioType;
  confidenceBias: number;
  impact: ScenarioImpact;
  tone: string;
  riskWeight: "low" | "high" | "balanced";
};

const PROFILES: TypeProfile[] = [
  {
    id: "best_case_v1",
    scenarioType: "BEST_CASE",
    confidenceBias: 10,
    impact: "HIGH",
    tone: "condições favoráveis se alinham",
    riskWeight: "low",
  },
  {
    id: "worst_case_v1",
    scenarioType: "WORST_CASE",
    confidenceBias: -5,
    impact: "HIGH",
    tone: "fricções e riscos se materializam",
    riskWeight: "high",
  },
  {
    id: "most_likely_v1",
    scenarioType: "MOST_LIKELY",
    confidenceBias: 5,
    impact: "MEDIUM",
    tone: "trajetória mais coerente com os sinais atuais",
    riskWeight: "balanced",
  },
  {
    id: "optimistic_v1",
    scenarioType: "OPTIMISTIC",
    confidenceBias: 8,
    impact: "MEDIUM",
    tone: "oportunidades pesam mais que riscos",
    riskWeight: "low",
  },
  {
    id: "conservative_v1",
    scenarioType: "CONSERVATIVE",
    confidenceBias: 0,
    impact: "LOW",
    tone: "cautela e preservação de opção",
    riskWeight: "high",
  },
  {
    id: "neutral_v1",
    scenarioType: "NEUTRAL",
    confidenceBias: 2,
    impact: "MEDIUM",
    tone: "sem viés forte — equilíbrio relativo",
    riskWeight: "balanced",
  },
];

function makeTypeEngine(profile: TypeProfile): ScenarioEngine {
  return {
    id: profile.id,
    scenarioType: profile.scenarioType,
    label: SCENARIO_TYPE_LABELS[profile.scenarioType],
    description: `Simula um cenário ${SCENARIO_TYPE_LABELS[profile.scenarioType].toLowerCase()} — hipotético, sem execução.`,
    simulate(context, options) {
      const max = options.max ?? 2;
      const prompt =
        options.whatIfPrompt?.trim() ||
        context.whatIfPrompt?.trim() ||
        "E se explorarmos a direção atual?";
      const project =
        context.sources.projects.find((p) => p.id === options.relatedProjectId) ??
        context.sources.projects[0];
      const decision =
        context.sources.decisions.find((d) => d.id === options.relatedDecisionId) ??
        context.sources.decisions[0];
      const discovery =
        profile.riskWeight === "high"
          ? context.sources.discoveries.find((d) =>
              ["RISK", "GAP", "STAGNATION"].includes(d.type)
            ) ?? context.sources.discoveries[0]
          : context.sources.discoveries.find((d) => d.type === "OPPORTUNITY") ??
            context.sources.discoveries[0];

      const evidence = [];
      if (project) {
        evidence.push(
          makeEvidence({
            evidenceType: "project_anchor",
            sourceLayer: "projects",
            sourceType: "project",
            sourceId: project.id,
            summary: project.name,
            confidence: 55,
          })
        );
      }
      if (decision) {
        evidence.push(
          makeEvidence({
            evidenceType: "decision_anchor",
            sourceLayer: "decision",
            sourceType: decision.kind,
            sourceId: decision.id,
            summary: decision.summary || decision.title,
            confidence: decision.confidence,
          })
        );
      }
      if (discovery) {
        evidence.push(
          makeEvidence({
            evidenceType: "discovery_signal",
            sourceLayer: "discovery",
            sourceType: discovery.type,
            sourceId: discovery.id,
            summary: discovery.summary || discovery.title,
            confidence: discovery.confidence,
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
      for (const doc of context.sources.knowledgeDocuments.slice(0, 1)) {
        evidence.push(
          makeEvidence({
            evidenceType: "knowledge_context",
            sourceLayer: "knowledge",
            sourceType: doc.type,
            sourceId: doc.id,
            summary: doc.title,
            confidence: 45,
          })
        );
      }

      if (!evidence.length) {
        evidence.push(
          makeEvidence({
            evidenceType: "thin_context",
            sourceLayer: "scenario",
            sourceType: "completeness",
            sourceId: context.correlationId,
            summary: `Completude ${context.dataCompleteness.score}/100`,
            confidence: 40,
            used: true,
          })
        );
      }

      const ignoredData = [
        ...context.dataCompleteness.gaps.map((g) => `gap:${g}`),
        "sinais financeiros automáticos (não utilizados)",
        "ações de execução / planner (fora de escopo)",
      ];

      const baseConf = Math.round(
        45 +
          profile.confidenceBias +
          context.dataCompleteness.score * 0.25 +
          (discovery?.confidence ?? 40) * 0.15
      );

      const otherTypes = (Object.keys(SCENARIO_TYPE_LABELS) as ScenarioType[])
        .filter((t) => t !== profile.scenarioType)
        .slice(0, 2);

      const candidate = buildScenarioCandidate({
        userId: options.userId,
        workspaceId: options.workspaceId,
        engineId: profile.id,
        scenarioType: profile.scenarioType,
        title: `${SCENARIO_TYPE_LABELS[profile.scenarioType]}: ${prompt.slice(0, 80)}`,
        description: `Simulação hipotética (${profile.tone}). Não é uma ordem de ação.`,
        context: [
          project ? `Projeto: ${project.name} (${project.status})` : null,
          decision ? `Decisão relacionada: ${decision.title}` : null,
          discovery ? `Discovery: ${discovery.title}` : null,
          `Pergunta: ${prompt}`,
        ]
          .filter(Boolean)
          .join(" · "),
        confidence: baseConf,
        impact: profile.impact,
        assumptions: [
          {
            id: newScenarioId("asm"),
            statement: `Assume-se que "${prompt}" é a intervenção hipotética central.`,
            confidence: 55,
            source: "what_if",
          },
          {
            id: newScenarioId("asm"),
            statement:
              profile.riskWeight === "high"
                ? "Riscos e fricções pesam mais neste ramo."
                : profile.riskWeight === "low"
                  ? "Oportunidades e alinhamentos pesam mais neste ramo."
                  : "Sinais positivos e negativos têm peso semelhante.",
            confidence: 50,
            source: profile.id,
          },
          {
            id: newScenarioId("asm"),
            statement: "Nenhuma camada upstream é alterada pela simulação.",
            confidence: 100,
            source: "policy",
          },
        ],
        limitations: [
          "Simulação hipotética — não executa ações.",
          "Não cria tarefas, missões nem altera projetos.",
          "Sem valores financeiros automáticos.",
          "Confiança limitada pelos dados disponíveis.",
          ...context.dataCompleteness.gaps.slice(0, 2).map((g) => `Lacuna: ${g}`),
        ],
        evidence,
        alternativeScenarios: otherTypes.map((t) => ({
          id: `alt_${t}`,
          title: SCENARIO_TYPE_LABELS[t],
          scenarioType: t,
          summary: `Comparar com ramo ${SCENARIO_TYPE_LABELS[t].toLowerCase()}.`,
        })),
        relatedDecisionId: decision?.id ?? options.relatedDecisionId ?? null,
        relatedProjectId: project?.id ?? options.relatedProjectId ?? null,
        relatedDiscoveryId: discovery?.id ?? null,
        relatedBusinessId: project?.businessId ?? context.sources.businesses[0]?.id ?? null,
        relatedDocumentIds: context.sources.knowledgeDocuments.slice(0, 2).map((d) => d.id),
        relatedMemoryIds: context.sources.memories.slice(0, 2).map((m) => m.id),
        whatIfPrompt: prompt,
        ignoredData,
        whyResult: `Chegamos a este ${SCENARIO_TYPE_LABELS[profile.scenarioType].toLowerCase()} porque ${profile.tone}, usando sinais read-only de projeto/discovery/decisão/conhecimento quando disponíveis.`,
        timeline: baseTimeline(prompt),
        uncertainty: {
          hypotheses: [
            `H1: ${prompt}`,
            profile.riskWeight === "high"
              ? "H2: Riscos dominam o desfecho relativo."
              : "H2: Oportunidades sustentam o desfecho relativo.",
          ],
          missingData: context.dataCompleteness.gaps,
          limitations: [
            "Resultado relativo, não preditivo absoluto.",
            "Ignora automação e execução.",
          ],
        },
        fingerprint: fingerprintOf(profile.id, [
          prompt.slice(0, 40),
          project?.id ?? "np",
          decision?.id ?? "nd",
          discovery?.id ?? "nx",
        ]),
      });

      return [candidate].slice(0, max);
    },
  };
}

export const typedScenarioEngines: ScenarioEngine[] = PROFILES.map(makeTypeEngine);

export const bestCaseEngine = typedScenarioEngines[0];
export const worstCaseEngine = typedScenarioEngines[1];
export const mostLikelyEngine = typedScenarioEngines[2];
export const optimisticEngine = typedScenarioEngines[3];
export const conservativeEngine = typedScenarioEngines[4];
export const neutralEngine = typedScenarioEngines[5];
