/**
 * Conflict Engine V1 — detect incompatibilities without silent resolution.
 */

import { calculateEvidenceConfidence, confidenceBand } from "@/lib/cognitive/confidence";
import { hashEvidenceSet, makeEvidence } from "@/lib/cognitive/evidence";
import { baseArtifact, fingerprint } from "@/lib/cognitive/patterns";
import {
  METHOD_VERSION,
  type CognitiveArtifact,
  type CognitiveContext,
  type ConflictNature,
} from "@/lib/cognitive/types";

export function detectConflicts(
  context: CognitiveContext,
  options?: { userId?: string; workspaceId?: string | null; maxConflicts?: number }
): CognitiveArtifact[] {
  const userId = options?.userId ?? "unknown";
  const workspaceId = options?.workspaceId ?? null;
  const max = options?.maxConflicts ?? 8;
  const out: CognitiveArtifact[] = [];

  // Same category+key with different values / scopes
  const byKey = new Map<string, typeof context.identityContext.claims>();
  for (const c of context.identityContext.claims) {
    if (["REJECTED", "DELETED"].includes(c.status)) continue;
    const k = `${c.category}::${c.key}`;
    const list = byKey.get(k) ?? [];
    list.push(c);
    byKey.set(k, list);
  }

  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    const values = new Set(list.map((c) => c.value));
    const scopes = new Set(list.map((c) => c.contextScope));
    if (values.size < 2) continue;

    let nature: ConflictNature = "contradiction";
    if (scopes.size > 1) nature = "contextual_difference";

    const evidence = list.map((c) =>
      makeEvidence({
        evidenceType: "identity_claim",
        sourceLayer: "identity",
        sourceType: "identity_engine",
        sourceId: c.id,
        confidence: c.confidence,
        authority: c.status === "CONFIRMED" ? 90 : 50,
        summary: `${c.category}.${c.key}=${c.value} @${c.contextScope}`,
        context: c.contextScope,
      })
    );

    const conf = Math.min(
      70,
      calculateEvidenceConfidence(evidence) + (nature === "contradiction" ? 10 : 0)
    );

    const title =
      nature === "contextual_difference"
        ? `Diferença contextual em ${key}`
        : `Possível contradição em ${key}`;

    const summary =
      nature === "contextual_difference"
        ? `Claims com o mesmo tema apresentam valores distintos em contextos diferentes. Isso pode coexistir e não é necessariamente um conflito real.`
        : `Claims com o mesmo tema e valores distintos foram encontradas. Revisão humana recomendada — o sistema não escolhe vencedor.`;

    const fp = fingerprint([
      "conflict",
      nature,
      key,
      hashEvidenceSet(evidence),
      METHOD_VERSION,
    ]);

    out.push(
      baseArtifact(userId, workspaceId, {
        artifactType: "CONFLICT",
        category: nature,
        title,
        summary,
        structuredContent: {
          nature,
          items: list.map((c) => ({
            id: c.id,
            value: c.value,
            status: c.status,
            confidence: c.confidence,
            contextScope: c.contextScope,
            authority: c.status === "CONFIRMED" ? "user_confirmed" : "inferred_or_learned",
          })),
          coexistencePossible: nature === "contextual_difference",
          reviewRecommendation: "Solicitar confirmação humana sem resolver automaticamente",
          potentialImpact: "Baixo até revisão — sem influência em execução",
        },
        evidence,
        confidence: conf,
        fingerprint: fp,
        evidenceSetHash: hashEvidenceSet(evidence),
        suppressionKey: `conflict:${nature}:${key}`,
        limitations: [
          "Autoridade por status da claim",
          "Sem resolução automática",
        ],
        alternativeHypotheses:
          nature === "contextual_difference"
            ? [
                {
                  statement: "Os valores são válidos em contextos distintos",
                  confidence: 60,
                  rationale: "Escopos diferentes observados",
                },
              ]
            : [
                {
                  statement: "Uma das claims está desatualizada",
                  confidence: 40,
                  rationale: "Mudança temporal possível",
                },
                {
                  statement: "Há erro de digitação ou ambiguidade semântica",
                  confidence: 30,
                  rationale: "Valores textuais podem divergir superficialmente",
                },
              ],
        identityClaimReferences: list.map((c) => ({
          entityType: "identity_claim",
          entityId: c.id,
        })),
        timeRange: context.temporalContext,
      })
    );
  }

  // Semantic memory vs identity claim disagreement (simple)
  for (const claim of context.identityContext.claims) {
    if (claim.status !== "CONFIRMED") continue;
    for (const mem of context.memoryContext.memories) {
      if (mem.memoryType !== "SEMANTIC") continue;
      const claimBlob = `${claim.key} ${claim.value}`.toLowerCase();
      const memBlob = `${mem.title} ${mem.summary}`.toLowerCase();
      if (
        claim.key.length > 2 &&
        memBlob.includes(claim.key.toLowerCase()) &&
        claim.value.length > 2 &&
        !memBlob.includes(claim.value.toLowerCase()) &&
        /não|nao|never|contrary|oposto|diferente/.test(memBlob)
      ) {
        const evidence = [
          makeEvidence({
            evidenceType: "identity_claim",
            sourceLayer: "identity",
            sourceType: "identity_engine",
            sourceId: claim.id,
            confidence: claim.confidence,
            authority: 90,
            summary: `${claim.key}=${claim.value}`,
          }),
          makeEvidence({
            evidenceType: "memory",
            sourceLayer: "memory",
            sourceType: "memory_engine",
            sourceId: mem.id,
            confidence: mem.confidence,
            authority: 55,
            summary: mem.title,
            supports: "counter",
          }),
        ];
        const nature: ConflictNature = "source_disagreement";
        const fp = fingerprint([
          "conflict",
          nature,
          claim.id,
          mem.id,
        ]);
        out.push(
          baseArtifact(userId, workspaceId, {
            artifactType: "CONFLICT",
            category: nature,
            title: "Desacordo entre identidade e memória",
            summary:
              "Uma claim confirmada e uma memória semântica parecem discordar. Correção humana prevalece; nenhuma fonte é alterada automaticamente.",
            structuredContent: {
              nature,
              coexistencePossible: true,
              reviewRecommendation: "Comparar claim e memória na UI de revisão",
            },
            evidence,
            counterEvidence: [evidence[1]],
            confidence: 45,
            fingerprint: fp,
            evidenceSetHash: hashEvidenceSet(evidence),
            suppressionKey: `conflict:${nature}:${claim.id}:${mem.id}`,
            limitations: ["Heurística textual simples — pode ser falso positivo"],
            timeRange: context.temporalContext,
          })
        );
      }
    }
  }

  // Stale world relationships vs active missions
  for (const rel of context.worldContext.relationships) {
    if (rel.status === "OUTDATED" || rel.status === "DISPUTED") {
      const evidence = context.evidenceIndex.filter((e) => e.sourceId === rel.id);
      const nature: ConflictNature = "stale_information";
      const fp = fingerprint(["conflict", nature, rel.id]);
      out.push(
        baseArtifact(userId, workspaceId, {
          artifactType: "CONFLICT",
          category: nature,
          title: "Relação do World Model possivelmente desatualizada",
          summary: `A relação ${rel.relationshipType} está marcada como ${rel.status}. Recomenda-se revisão — sem alteração silenciosa da fonte.`,
          structuredContent: {
            nature,
            relationshipId: rel.id,
            coexistencePossible: false,
            reviewRecommendation: "Revalidar relação no Mapa do Aura",
          },
          evidence:
            evidence.length > 0
              ? evidence
              : [
                  makeEvidence({
                    evidenceType: "world_relationship",
                    sourceLayer: "world_model",
                    sourceType: "world_model",
                    sourceId: rel.id,
                    confidence: rel.confidence,
                    summary: rel.relationshipType,
                  }),
                ],
          confidence: confidenceBand(rel.confidence) === "HIGH" ? 55 : 40,
          fingerprint: fp,
          evidenceSetHash: hashEvidenceSet(evidence),
          suppressionKey: `conflict:${nature}:${rel.id}`,
          limitations: ["Status herdado da projeção"],
          timeRange: context.temporalContext,
        })
      );
    }
  }

  return out.slice(0, max);
}
