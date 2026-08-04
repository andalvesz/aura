/**
 * Business context builder — never mixes personal Identity data.
 */

import { listKnowledgeArticles } from "@/lib/business-expert/knowledge";
import { listDomainIds } from "@/lib/business-expert/registry";
import type {
  BusinessContext,
  BusinessObjective,
  BusinessProfile,
  BusinessVenture,
  SupportedBusinessType,
} from "@/lib/business-expert/types";
import { validateBusinessProfile } from "@/lib/business-expert/validators";

const PERSONAL_LEAK_KEYS = [
  "identityClaims",
  "personalHealth",
  "relationshipStatus",
  "personalMemories",
  "identityId",
  "cognitiveClaims",
] as const;

export function assertNoPersonalIdentityData(
  payload: unknown
): { clean: boolean; leaks: string[] } {
  if (!payload || typeof payload !== "object") return { clean: true, leaks: [] };
  const obj = payload as Record<string, unknown>;
  const leaks = PERSONAL_LEAK_KEYS.filter((k) => k in obj);
  return { clean: leaks.length === 0, leaks: [...leaks] };
}

function computeGaps(
  profile: BusinessProfile,
  objectives: BusinessObjective[],
  ventures: BusinessVenture[]
): string[] {
  const gaps: string[] = [];
  if (profile.experience === "none" || profile.experience === "beginner") {
    if (!profile.skills.length) gaps.push("skills_not_listed");
  }
  if (profile.capital === "unknown") gaps.push("capital_unknown");
  if (profile.availability === "unknown") gaps.push("availability_unknown");
  if (!profile.objectives.length && !objectives.length) gaps.push("no_objectives");
  if (!profile.interestAreas.length) gaps.push("no_interest_areas");
  if (
    !profile.preferredBusinessTypes.length &&
    !ventures.length &&
    !profile.currentBusinesses.length
  ) {
    gaps.push("no_business_direction");
  }
  if (!ventures.length) gaps.push("no_ventures");
  if (profile.team === "unknown") gaps.push("team_unknown");
  if (!profile.activeMode) gaps.push("mode_not_set");
  return gaps;
}

export function buildBusinessContext(input: {
  profile: BusinessProfile;
  objectives?: BusinessObjective[];
  ventures?: BusinessVenture[];
  now?: string;
}): BusinessContext {
  const profileCheck = validateBusinessProfile(input.profile);
  if (!profileCheck.ok) {
    throw new Error(
      `Invalid business profile: ${profileCheck.issues.map((i) => i.code).join(", ")}`
    );
  }
  const leak = assertNoPersonalIdentityData(input.profile);
  if (!leak.clean) {
    throw new Error(
      `Personal data must not appear in business profile: ${leak.leaks.join(", ")}`
    );
  }

  const objectives = (input.objectives ?? []).filter(
    (o) => o.userId === input.profile.userId
  );
  const ventures = (input.ventures ?? []).filter(
    (v) => v.userId === input.profile.userId
  );
  const activeDomains =
    input.profile.interestAreas.length > 0
      ? input.profile.interestAreas
      : listDomainIds().slice(0, 6);

  const fromVentures: SupportedBusinessType[] = ventures.map((v) => v.type);
  const activeBusinessTypes = [
    ...new Set([...input.profile.preferredBusinessTypes, ...fromVentures]),
  ];

  const knowledgeIds = listKnowledgeArticles()
    .filter(
      (a) =>
        activeDomains.includes(a.domain) ||
        a.relatedBusinessTypes.some((t) => activeBusinessTypes.includes(t))
    )
    .map((a) => a.id);

  const context: BusinessContext = {
    kind: "business_context",
    version: "1.1.0",
    userId: input.profile.userId,
    profile: {
      ...input.profile,
      preferences: { ...input.profile.preferences },
      objectives: [...input.profile.objectives],
      interestAreas: [...input.profile.interestAreas],
      skills: [...input.profile.skills],
      currentBusinesses: [...input.profile.currentBusinesses],
      pastBusinesses: [...input.profile.pastBusinesses],
      preferredBusinessTypes: [...input.profile.preferredBusinessTypes],
      notes: [...input.profile.notes],
    },
    objectives,
    ventures,
    activeDomains,
    activeBusinessTypes,
    activeMode: input.profile.activeMode ?? null,
    knowledgeIds,
    gaps: computeGaps(input.profile, objectives, ventures),
    limitations: [
      "B1.X: knowledge interno + web research provider (sem crawler embutido)",
      "Sem APIs comerciais externas de marketplace nesta camada",
      "Jurídico/impostos: orientação, não assessoria profissional",
      "Contexto empresarial isolado do Identity",
    ],
    generatedAt: input.now ?? new Date().toISOString(),
  };

  const ctxLeak = assertNoPersonalIdentityData(context);
  if (!ctxLeak.clean) throw new Error(`Context leakage: ${ctxLeak.leaks.join(", ")}`);
  return context;
}

export function profileCompleteness(profile: BusinessProfile): number {
  const checks = [
    profile.experience !== "none",
    profile.capital !== "unknown",
    profile.availability !== "unknown",
    profile.team !== "unknown",
    profile.objectives.length > 0,
    profile.interestAreas.length > 0,
    profile.skills.length > 0,
    profile.preferredBusinessTypes.length > 0 ||
      profile.currentBusinesses.length > 0,
    Boolean(profile.activeMode),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
