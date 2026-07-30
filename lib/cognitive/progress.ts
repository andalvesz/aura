/**
 * Progress Engine V1 — neutral evolution observations.
 */

import { calculatePatternConfidence, confidenceBand } from "@/lib/cognitive/confidence";
import { hashEvidenceSet } from "@/lib/cognitive/evidence";
import { baseArtifact, fingerprint } from "@/lib/cognitive/patterns";
import {
  METHOD_VERSION,
  MIN_PATTERN_SAMPLE,
  type CognitiveArtifact,
  type CognitiveContext,
} from "@/lib/cognitive/types";

export function analyzeProgress(
  context: CognitiveContext,
  options?: { userId?: string; workspaceId?: string | null }
): CognitiveArtifact[] {
  const userId = options?.userId ?? "unknown";
  const workspaceId = options?.workspaceId ?? null;
  const missions = context.missionContext.missions;
  const out: CognitiveArtifact[] = [];

  if (missions.length === 0) {
    out.push(
      baseArtifact(userId, workspaceId, {
        artifactType: "INSUFFICIENT_EVIDENCE",
        category: "progress",
        title: "Dados insuficientes para observar progresso",
        summary:
          "Não há missões elegíveis no contexto. Ausência de evidência não é evidência de ausência.",
        structuredContent: { reason: "no_missions", sampleSize: 0 },
        evidence: [],
        confidence: 10,
        fingerprint: fingerprint(["progress", "insufficient", context.correlationId]),
        evidenceSetHash: "empty",
        suppressionKey: "progress:insufficient",
        limitations: ["Contexto sem missões"],
        timeRange: context.temporalContext,
      })
    );
    return out;
  }

  const withProgress = missions.filter((m) => typeof m.progress === "number");
  const evidence = context.evidenceIndex.filter((e) =>
    missions.some((m) => m.id === e.sourceId)
  );

  if (withProgress.length < MIN_PATTERN_SAMPLE) {
    out.push(
      baseArtifact(userId, workspaceId, {
        artifactType: "PROGRESS_OBSERVATION",
        category: "insufficient_sample",
        title: "Amostra limitada de progresso",
        summary: `Apenas ${withProgress.length} missão(ões) com progresso numérico. Observação preliminar — sem inferência de motivação ou disciplina.`,
        structuredContent: {
          sampleSize: withProgress.length,
          observation: "insufficient_sample",
        },
        evidence,
        confidence: 20,
        fingerprint: fingerprint(["progress", "small", hashEvidenceSet(evidence)]),
        evidenceSetHash: hashEvidenceSet(evidence),
        suppressionKey: "progress:small_sample",
        limitations: ["Amostra pequena", "Sem inferência psicológica"],
        timeRange: context.temporalContext,
      })
    );
    return out;
  }

  const avg =
    withProgress.reduce((s, m) => s + (m.progress ?? 0), 0) / withProgress.length;
  const high = withProgress.filter((m) => (m.progress ?? 0) >= 70).length;
  const low = withProgress.filter((m) => (m.progress ?? 0) < 30).length;
  const paused = missions.filter((m) => /paused|hold|inactive/i.test(m.status))
    .length;

  let observation = "stability";
  let title = "Estabilidade aparente no progresso das missões";
  let summary = `A frequência de execução/progresso médio observado é de aproximadamente ${Math.round(avg)}% entre ${withProgress.length} missões com dados.`;

  if (low > high && paused > 0) {
    observation = "apparent_slowdown";
    title = "Redução aparente de ritmo em missões";
    summary = `A frequência de progresso alto diminuiu relativamente: ${low} missões abaixo de 30% e ${paused} pausadas/inativas, entre ${missions.length} no contexto. Linguagem neutra — sem inferir fracasso pessoal.`;
  } else if (high > low) {
    observation = "forward_motion";
    title = "Continuidade observada em missões";
    summary = `${high} de ${withProgress.length} missões com progresso ≥70% no contexto analisado.`;
  }

  const conf = calculatePatternConfidence({
    evidence,
    sampleSize: withProgress.length,
    minSample: MIN_PATTERN_SAMPLE,
    consistency: high / Math.max(1, withProgress.length),
    hasContradiction: paused > 0 && high > 0,
    counterEvidenceCount: paused > 0 ? 1 : 0,
  });

  out.push(
    baseArtifact(userId, workspaceId, {
      artifactType: "PROGRESS_OBSERVATION",
      category: observation,
      title,
      summary,
      structuredContent: {
        observation,
        sampleSize: withProgress.length,
        averageProgress: Math.round(avg),
        highCount: high,
        lowCount: low,
        pausedCount: paused,
        confidenceBand: confidenceBand(conf),
      },
      evidence,
      confidence: conf,
      fingerprint: fingerprint([
        "progress",
        observation,
        hashEvidenceSet(evidence),
        METHOD_VERSION,
      ]),
      evidenceSetHash: hashEvidenceSet(evidence),
      suppressionKey: `progress:${observation}`,
      limitations: [
        "Não inferir motivação, disciplina ou traço psicológico",
        "Progresso depende de atualização do Mission Engine",
      ],
      alternativeHypotheses: [
        {
          statement: "Missões com menos progresso são mais complexas",
          confidence: 40,
          rationale: "Complexidade não medida diretamente",
        },
        {
          statement: "Dados de progresso estão desatualizados",
          confidence: 35,
          rationale: "Freshness do domínio não auditada aqui",
        },
      ],
      missionReferences: missions.map((m) => ({
        entityType: "mission",
        entityId: m.id,
      })),
      timeRange: context.temporalContext,
      patternConfidence: conf,
    })
  );

  return out;
}
