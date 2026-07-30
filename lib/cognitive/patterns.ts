/**
 * Pattern Engine V1 — deterministic pattern detection.
 */

import {
  calculatePatternConfidence,
  calibratedLanguage,
  confidenceBand,
} from "@/lib/cognitive/confidence";
import { hashEvidenceSet } from "@/lib/cognitive/evidence";
import {
  METHOD_VERSION,
  MIN_PATTERN_SAMPLE,
  type CognitiveArtifact,
  type CognitiveContext,
  type PatternKind,
} from "@/lib/cognitive/types";
import { createHash } from "node:crypto";

export type PatternDetectionResult = {
  patterns: CognitiveArtifact[];
  insufficientData: boolean;
  method: string;
  limitations: string[];
};

function fingerprint(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 40);
}

function baseArtifact(
  userId: string,
  workspaceId: string | null,
  partial: Partial<CognitiveArtifact> &
    Pick<
      CognitiveArtifact,
      | "artifactType"
      | "category"
      | "title"
      | "summary"
      | "structuredContent"
      | "evidence"
      | "confidence"
      | "fingerprint"
      | "evidenceSetHash"
      | "suppressionKey"
    >
): CognitiveArtifact {
  const now = new Date().toISOString();
  const band = confidenceBand(partial.confidence);
  return {
    id: `cog_${fingerprint([partial.fingerprint, now]).slice(0, 16)}`,
    userId,
    workspaceId,
    artifactType: partial.artifactType,
    category: partial.category,
    status: "GENERATED",
    title: partial.title,
    summary: partial.summary,
    structuredContent: partial.structuredContent,
    subjectReferences: partial.subjectReferences ?? [],
    entityReferences: partial.entityReferences ?? [],
    memoryReferences: partial.memoryReferences ?? [],
    identityClaimReferences: partial.identityClaimReferences ?? [],
    missionReferences: partial.missionReferences ?? [],
    evidence: partial.evidence,
    counterEvidence: partial.counterEvidence ?? [],
    assumptions: partial.assumptions ?? [],
    alternativeHypotheses: partial.alternativeHypotheses ?? [],
    method: partial.method ?? "pattern_engine_v1",
    methodVersion: METHOD_VERSION,
    confidence: partial.confidence,
    confidenceBand: band,
    confidenceMethodVersion: "cognitive-confidence-v1",
    evidenceConfidence: partial.evidenceConfidence ?? partial.confidence,
    patternConfidence: partial.patternConfidence ?? partial.confidence,
    hypothesisConfidence: null,
    insightConfidence: null,
    recommendationConfidence: null,
    importance: partial.importance ?? 50,
    impact: partial.impact ?? 40,
    novelty: partial.novelty ?? 40,
    actionability: partial.actionability ?? 20,
    sensitivity: "STANDARD",
    timeRange: partial.timeRange ?? {
      from: null,
      to: null,
      label: "observed_window",
    },
    validFrom: now,
    validUntil: null,
    firstGeneratedAt: now,
    lastValidatedAt: null,
    supersedesArtifactId: null,
    supersededByArtifactId: null,
    suppressionKey: partial.suppressionKey,
    fingerprint: partial.fingerprint,
    evidenceSetHash: partial.evidenceSetHash,
    generatedBy: "deterministic",
    providerMetadata: null,
    executionInfluence: "none",
    limitations: partial.limitations ?? [],
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    deletedAt: null,
    metadata: {},
  };
}

export function detectPatterns(
  context: CognitiveContext,
  options?: { userId?: string; workspaceId?: string | null; maxPatterns?: number }
): PatternDetectionResult {
  const userId = options?.userId ?? "unknown";
  const workspaceId = options?.workspaceId ?? null;
  const max = options?.maxPatterns ?? 8;
  const patterns: CognitiveArtifact[] = [];
  const limitations: string[] = [];

  const missions = context.missionContext.missions;
  const memories = context.memoryContext.memories;
  const claims = context.identityContext.claims;
  const sampleSize = context.dataCompleteness.sampleSize;

  if (sampleSize < MIN_PATTERN_SAMPLE) {
    limitations.push("sample_below_minimum");
    return {
      patterns: [],
      insufficientData: true,
      method: "pattern_engine_v1",
      limitations,
    };
  }

  // Frequency / category distribution of missions by type
  if (missions.length >= MIN_PATTERN_SAMPLE) {
    const byType = new Map<string, typeof missions>();
    for (const m of missions) {
      const list = byType.get(m.type) ?? [];
      list.push(m);
      byType.set(m.type, list);
    }
    for (const [type, list] of byType) {
      if (list.length < 2) continue;
      const pct = Math.round((list.length / missions.length) * 100);
      const evidence = context.evidenceIndex.filter(
        (e) =>
          e.sourceLayer === "mission" && list.some((m) => m.id === e.sourceId)
      );
      const conf = calculatePatternConfidence({
        evidence,
        sampleSize: list.length,
        minSample: MIN_PATTERN_SAMPLE,
        consistency: list.length / missions.length,
        hasContradiction: false,
        counterEvidenceCount: 0,
      });
      const kind: PatternKind = "category_distribution";
      const fp = fingerprint([
        "pattern",
        kind,
        type,
        hashEvidenceSet(evidence),
        METHOD_VERSION,
      ]);
      patterns.push(
        baseArtifact(userId, workspaceId, {
          artifactType: "PATTERN",
          category: kind,
          title: `Concentração de missões do tipo ${type}`,
          summary: `No período analisado, ${list.length} de ${missions.length} missões (${pct}%) são do tipo ${type}. Isso é uma observação de frequência, não uma regra universal.`,
          structuredContent: {
            patternKind: kind,
            sampleSize: list.length,
            total: missions.length,
            absoluteCount: list.length,
            percent: pct,
            categoryValue: type,
            baseline: Math.round(100 / Math.max(1, byType.size)),
          },
          evidence,
          confidence: conf,
          fingerprint: fp,
          evidenceSetHash: hashEvidenceSet(evidence),
          suppressionKey: `pattern:${kind}:${type}`,
          limitations: [
            "Correlação/frequência observada — não implica causalidade",
            list.length < MIN_PATTERN_SAMPLE
              ? "Amostra pequena"
              : "Amostra limitada ao contexto carregado",
          ],
          timeRange: context.temporalContext,
          patternConfidence: conf,
          evidenceConfidence: conf,
        })
      );
    }
  }

  // Completion / consistency among missions with progress
  const withProgress = missions.filter((m) => m.progress != null);
  if (withProgress.length >= MIN_PATTERN_SAMPLE) {
    const completed = withProgress.filter(
      (m) => (m.progress ?? 0) >= 100 || m.status.toLowerCase().includes("complet")
    );
    const abandoned = withProgress.filter((m) =>
      /cancel|abandon|archiv/i.test(m.status)
    );
    const evidence = context.evidenceIndex.filter((e) =>
      withProgress.some((m) => m.id === e.sourceId)
    );
    if (completed.length > 0) {
      const conf = calculatePatternConfidence({
        evidence,
        sampleSize: withProgress.length,
        minSample: MIN_PATTERN_SAMPLE,
        consistency: completed.length / withProgress.length,
        hasContradiction: abandoned.length > 0,
        counterEvidenceCount: abandoned.length > 0 ? 1 : 0,
      });
      const kind: PatternKind = "completion";
      const fp = fingerprint([
        "pattern",
        kind,
        String(completed.length),
        hashEvidenceSet(evidence),
      ]);
      patterns.push(
        baseArtifact(userId, workspaceId, {
          artifactType: "PATTERN",
          category: kind,
          title: "Taxa de conclusão observada em missões",
          summary: `${calibratedLanguage(confidenceBand(conf))} que ${completed.length} de ${withProgress.length} missões com progresso registrado atingiram conclusão no contexto analisado.`,
          structuredContent: {
            patternKind: kind,
            sampleSize: withProgress.length,
            absoluteCount: completed.length,
            percent: Math.round((completed.length / withProgress.length) * 100),
            abandonedCount: abandoned.length,
          },
          evidence,
          counterEvidence: abandoned.length
            ? evidence.filter((e) =>
                abandoned.some((m) => m.id === e.sourceId)
              )
            : [],
          confidence: conf,
          fingerprint: fp,
          evidenceSetHash: hashEvidenceSet(evidence),
          suppressionKey: `pattern:${kind}:missions`,
          limitations: [
            "Progresso reportado pode estar incompleto",
            "Não indica motivação ou disciplina pessoal",
          ],
          timeRange: context.temporalContext,
          patternConfidence: conf,
        })
      );
    }
  }

  // Rejection / acceptance pattern from claim statuses
  const rejectedClaims = claims.filter((c) => c.status === "REJECTED");
  const confirmedClaims = claims.filter((c) => c.status === "CONFIRMED");
  if (claims.length >= MIN_PATTERN_SAMPLE && rejectedClaims.length >= 2) {
    const evidence = context.evidenceIndex.filter((e) =>
      rejectedClaims.some((c) => c.id === e.sourceId)
    );
    const conf = calculatePatternConfidence({
      evidence,
      sampleSize: rejectedClaims.length,
      minSample: 2,
      consistency: rejectedClaims.length / claims.length,
      hasContradiction: false,
      counterEvidenceCount: 0,
    });
    const kind: PatternKind = "rejection";
    const fp = fingerprint(["pattern", kind, hashEvidenceSet(evidence)]);
    patterns.push(
      baseArtifact(userId, workspaceId, {
        artifactType: "PATTERN",
        category: kind,
        title: "Rejeições recorrentes em claims de identidade",
        summary: `Foram observadas ${rejectedClaims.length} rejeições entre ${claims.length} claims no contexto. Isso sugere preferência de revisão, não um traço psicológico.`,
        structuredContent: {
          patternKind: kind,
          sampleSize: claims.length,
          absoluteCount: rejectedClaims.length,
          confirmedCount: confirmedClaims.length,
          percent: Math.round((rejectedClaims.length / claims.length) * 100),
        },
        evidence,
        confidence: conf,
        fingerprint: fp,
        evidenceSetHash: hashEvidenceSet(evidence),
        suppressionKey: `pattern:${kind}:identity`,
        limitations: ["Baseado apenas em claims carregadas no contexto"],
        timeRange: context.temporalContext,
        patternConfidence: conf,
      })
    );
  }

  // Memory type concentration
  if (memories.length >= MIN_PATTERN_SAMPLE) {
    const byMemType = new Map<string, number>();
    for (const m of memories) {
      byMemType.set(m.memoryType, (byMemType.get(m.memoryType) ?? 0) + 1);
    }
    let topType = "";
    let topCount = 0;
    for (const [t, n] of byMemType) {
      if (n > topCount) {
        topType = t;
        topCount = n;
      }
    }
    if (topCount >= 2) {
      const evidence = context.evidenceIndex.filter(
        (e) =>
          e.sourceLayer === "memory" &&
          memories.some((m) => m.memoryType === topType && m.id === e.sourceId)
      );
      const conf = calculatePatternConfidence({
        evidence,
        sampleSize: topCount,
        minSample: 2,
        consistency: topCount / memories.length,
        hasContradiction: false,
        counterEvidenceCount: 0,
      });
      const kind: PatternKind = "context_concentration";
      const fp = fingerprint(["pattern", kind, topType, hashEvidenceSet(evidence)]);
      patterns.push(
        baseArtifact(userId, workspaceId, {
          artifactType: "PATTERN",
          category: kind,
          title: `Concentração de memórias do tipo ${topType}`,
          summary: `${topCount} de ${memories.length} memórias elegíveis são do tipo ${topType} no período/contexto analisado.`,
          structuredContent: {
            patternKind: kind,
            sampleSize: memories.length,
            absoluteCount: topCount,
            percent: Math.round((topCount / memories.length) * 100),
            categoryValue: topType,
          },
          evidence,
          confidence: conf,
          fingerprint: fp,
          evidenceSetHash: hashEvidenceSet(evidence),
          suppressionKey: `pattern:${kind}:${topType}`,
          limitations: ["Volume limitado pelo budget de contexto"],
          timeRange: context.temporalContext,
          patternConfidence: conf,
        })
      );
    }
  }

  // Trend change: mix of active vs inactive missions
  if (missions.length >= MIN_PATTERN_SAMPLE) {
    const active = missions.filter((m) =>
      /active|progress|in_progress|running/i.test(m.status)
    );
    const inactive = missions.filter((m) =>
      /paused|hold|stale|inactive/i.test(m.status)
    );
    if (active.length > 0 && inactive.length > 0) {
      const evidence = context.evidenceIndex.filter((e) =>
        missions.some((m) => m.id === e.sourceId)
      );
      const conf = calculatePatternConfidence({
        evidence,
        sampleSize: missions.length,
        minSample: MIN_PATTERN_SAMPLE,
        consistency: 0.5,
        hasContradiction: false,
        counterEvidenceCount: 0,
      });
      const kind: PatternKind = "trend_change";
      const fp = fingerprint(["pattern", kind, hashEvidenceSet(evidence)]);
      patterns.push(
        baseArtifact(userId, workspaceId, {
          artifactType: "PATTERN",
          category: kind,
          title: "Distribuição entre missões ativas e pausadas",
          summary: `Observadas ${active.length} missões ativas e ${inactive.length} pausadas/inativas no contexto. Linguagem neutra: mudança de ritmo possível, sem inferir fracasso pessoal.`,
          structuredContent: {
            patternKind: kind,
            sampleSize: missions.length,
            activeCount: active.length,
            inactiveCount: inactive.length,
          },
          evidence,
          confidence: conf,
          fingerprint: fp,
          evidenceSetHash: hashEvidenceSet(evidence),
          suppressionKey: `pattern:${kind}:mission_pace`,
          limitations: ["Estados de missão dependem de atualização do domínio"],
          timeRange: context.temporalContext,
          patternConfidence: conf,
        })
      );
    }
  }

  return {
    patterns: patterns.slice(0, max),
    insufficientData: patterns.length === 0,
    method: "pattern_engine_v1",
    limitations:
      patterns.length === 0
        ? [...limitations, "no_patterns_above_threshold"]
        : limitations,
  };
}

export { baseArtifact, fingerprint };
