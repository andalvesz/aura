/**
 * Discovery detector for Business Expert signals.
 * Registered into core Discovery registry — not a parallel discovery engine.
 */

import { buildCandidate, makeEvidence } from "@/lib/discovery/detectors/_helpers";
import type { DiscoveryDetector } from "@/lib/discovery/types";
import {
  detectBusinessOpportunities,
  ensureBusinessProfile,
  buildBusinessContext,
  listObjectivesForUser,
  listVenturesForUser,
} from "@/lib/business-expert";

export const businessExpertOpportunityDetector: DiscoveryDetector = {
  id: "business_expert_opportunity_v1",
  type: "OPPORTUNITY",
  label: "Business Expert · Oportunidades",
  description:
    "Sinaliza oportunidades empresariais a partir do Business Expert (perfil, gaps, modos).",
  detect(_context, options) {
    const max = options.max ?? 4;
    try {
      const profile = ensureBusinessProfile(options.userId);
      const ctx = buildBusinessContext({
        profile,
        objectives: listObjectivesForUser(options.userId),
        ventures: listVenturesForUser(options.userId),
      });
      const signals = detectBusinessOpportunities(ctx).slice(0, max);
      return signals.map((s) =>
        buildCandidate({
          userId: options.userId,
          workspaceId: options.workspaceId ?? null,
          type: "OPPORTUNITY",
          detectorId: "business_expert_opportunity_v1",
          title: s.title,
          summary: s.summary,
          explanation:
            "Derivado do Business Expert (knowledge + perfil empresarial). Sem execução e sem inventar dados de mercado recentes.",
          evidence: [
            makeEvidence({
              evidenceType: "business_expert_signal",
              sourceLayer: "cognitive",
              sourceType: s.kind,
              sourceId: s.id,
              summary: s.summary,
              confidence: s.confidence,
            }),
          ],
          relatedArtifacts: [],
          relatedInsights: [],
          relatedMemories: [],
          relatedEntities: [],
          impact: s.confidence >= 65 ? "HIGH" : "MEDIUM",
          urgency: "MEDIUM",
          baseConfidence: s.confidence,
          suppressionParts: ["business_expert", s.kind, s.title],
          alternativeInterpretations: [
            "Pode não ser prioritário no contexto atual",
            "Pode exigir mais dados do perfil empresarial",
          ],
        })
      );
    } catch {
      return [];
    }
  },
};
