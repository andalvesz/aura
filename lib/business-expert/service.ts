/**
 * In-memory store — profiles, ventures, ideas, knowledge ingests.
 */

import type {
  BusinessExpertState,
  BusinessObjective,
  BusinessObjectiveKind,
  BusinessProfile,
  BusinessVenture,
  BusinessKnowledgeDomainId,
  BusinessVentureStatus,
  SupportedBusinessType,
  BusinessModeId,
  IdeaValidationResult,
  KnowledgeIngestRequest,
  KnowledgeIngestRecord,
} from "@/lib/business-expert/types";
import {
  validateBusinessObjective,
  validateBusinessProfile,
  validateBusinessVenture,
} from "@/lib/business-expert/validators";

let state: BusinessExpertState = createEmptyBusinessExpertState();

function nid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function createEmptyBusinessExpertState(): BusinessExpertState {
  return { profiles: [], objectives: [], ventures: [], ideas: [], ingests: [] };
}

export function getBusinessExpertState(): BusinessExpertState {
  return state;
}

export function setBusinessExpertState(next: BusinessExpertState): void {
  state = next;
}

export function clearBusinessExpertState(): void {
  state = createEmptyBusinessExpertState();
}

export function defaultBusinessProfile(
  userId: string,
  now?: string
): BusinessProfile {
  const ts = now ?? new Date().toISOString();
  return {
    userId,
    kind: "business_profile",
    version: "1.1.0",
    experience: "none",
    capital: "unknown",
    objectives: [],
    interestAreas: [],
    skills: [],
    currentBusinesses: [],
    pastBusinesses: [],
    availability: "unknown",
    team: "solo",
    preferences: {},
    preferredBusinessTypes: [],
    activeMode: null,
    notes: [],
    createdAt: ts,
    updatedAt: ts,
  };
}

export function ensureBusinessProfile(
  userId: string,
  now?: string
): BusinessProfile {
  const existing = state.profiles.find((p) => p.userId === userId);
  if (existing) {
    // soft-migrate missing B1.X fields
    if (existing.activeMode === undefined || existing.version !== "1.1.0") {
      const migrated = {
        ...defaultBusinessProfile(userId, now),
        ...existing,
        version: "1.1.0" as const,
        activeMode: existing.activeMode ?? null,
      };
      state = {
        ...state,
        profiles: [migrated, ...state.profiles.filter((p) => p.userId !== userId)],
      };
      return migrated;
    }
    return existing;
  }
  const profile = defaultBusinessProfile(userId, now);
  state = { ...state, profiles: [profile, ...state.profiles] };
  return profile;
}

export function getBusinessProfile(userId: string): BusinessProfile | null {
  return state.profiles.find((p) => p.userId === userId) ?? null;
}

export function upsertBusinessProfile(
  partial: Partial<BusinessProfile> & { userId: string },
  now?: string
): { ok: true; profile: BusinessProfile } | { ok: false; issues: string[] } {
  const ts = now ?? new Date().toISOString();
  const current = ensureBusinessProfile(partial.userId, ts);
  const next: BusinessProfile = {
    ...current,
    ...partial,
    userId: partial.userId,
    kind: "business_profile",
    version: "1.1.0",
    preferences: partial.preferences
      ? { ...current.preferences, ...partial.preferences }
      : current.preferences,
    updatedAt: ts,
    createdAt: current.createdAt,
  };
  const validation = validateBusinessProfile(next);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues.map((i) => i.message) };
  }
  state = {
    ...state,
    profiles: [next, ...state.profiles.filter((p) => p.userId !== partial.userId)],
  };
  return { ok: true, profile: next };
}

export function setBusinessMode(
  userId: string,
  mode: BusinessModeId | null
): BusinessProfile {
  const res = upsertBusinessProfile({ userId, activeMode: mode });
  if (!res.ok) return ensureBusinessProfile(userId);
  return res.profile;
}

export function listObjectivesForUser(userId: string): BusinessObjective[] {
  return state.objectives.filter((o) => o.userId === userId);
}

export function addBusinessObjective(input: {
  userId: string;
  kind: BusinessObjectiveKind;
  title: string;
  description?: string;
  relatedDomains?: BusinessKnowledgeDomainId[];
  relatedBusinessTypes?: SupportedBusinessType[];
  successCriteria?: string[];
  now?: string;
}): { ok: true; objective: BusinessObjective } | { ok: false; issues: string[] } {
  const ts = input.now ?? new Date().toISOString();
  const objective: BusinessObjective = {
    id: nid("obj"),
    userId: input.userId,
    kind: input.kind,
    title: input.title,
    description: input.description ?? "",
    status: "active",
    relatedDomains: input.relatedDomains ?? [],
    relatedBusinessTypes: input.relatedBusinessTypes ?? [],
    successCriteria: input.successCriteria ?? [],
    createdAt: ts,
    updatedAt: ts,
  };
  const validation = validateBusinessObjective(objective);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues.map((i) => i.message) };
  }
  state = { ...state, objectives: [objective, ...state.objectives] };
  const profile = ensureBusinessProfile(input.userId, ts);
  if (!profile.objectives.includes(input.title)) {
    upsertBusinessProfile({
      userId: input.userId,
      objectives: [...profile.objectives, input.title],
    }, ts);
  }
  return { ok: true, objective };
}

export function listVenturesForUser(userId: string): BusinessVenture[] {
  return state.ventures.filter((v) => v.userId === userId);
}

export function addBusinessVenture(input: {
  userId: string;
  name: string;
  type: SupportedBusinessType;
  status?: BusinessVentureStatus;
  summary?: string;
  domains?: BusinessKnowledgeDomainId[];
  monetizationModel?: string | null;
  mode?: BusinessModeId | null;
  stageNotes?: string[];
  now?: string;
}): { ok: true; venture: BusinessVenture } | { ok: false; issues: string[] } {
  const ts = input.now ?? new Date().toISOString();
  const venture: BusinessVenture = {
    id: nid("ven"),
    userId: input.userId,
    name: input.name,
    type: input.type,
    status: input.status ?? "idea",
    summary: input.summary ?? "",
    domains: input.domains ?? [],
    monetizationModel: input.monetizationModel ?? null,
    mode: input.mode ?? null,
    stageNotes: input.stageNotes ?? [],
    createdAt: ts,
    updatedAt: ts,
  };
  const validation = validateBusinessVenture(venture);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues.map((i) => i.message) };
  }
  state = { ...state, ventures: [venture, ...state.ventures] };
  const profile = ensureBusinessProfile(input.userId, ts);
  const isPast = venture.status === "past" || venture.status === "closed";
  if (isPast) {
    if (!profile.pastBusinesses.includes(venture.name)) {
      upsertBusinessProfile({
        userId: input.userId,
        pastBusinesses: [...profile.pastBusinesses, venture.name],
      }, ts);
    }
  } else if (!profile.currentBusinesses.includes(venture.name)) {
    upsertBusinessProfile({
      userId: input.userId,
      currentBusinesses: [...profile.currentBusinesses, venture.name],
      preferredBusinessTypes: profile.preferredBusinessTypes.includes(venture.type)
        ? profile.preferredBusinessTypes
        : [...profile.preferredBusinessTypes, venture.type],
    }, ts);
  }
  return { ok: true, venture };
}

export function saveIdeaValidation(
  userId: string,
  result: IdeaValidationResult,
  now?: string
): void {
  const ts = now ?? new Date().toISOString();
  state = {
    ...state,
    ideas: [
      { ...result, id: nid("idea"), userId, createdAt: ts },
      ...state.ideas,
    ],
  };
}

export function listIdeasForUser(userId: string) {
  return state.ideas.filter((i) => i.userId === userId);
}

export function queueKnowledgeIngest(
  input: KnowledgeIngestRequest,
  now?: string
): KnowledgeIngestRecord {
  const ts = now ?? new Date().toISOString();
  const rec: KnowledgeIngestRecord = {
    id: nid("ing"),
    userId: input.userId,
    title: input.title,
    kind: input.kind,
    sourceRef: input.sourceRef,
    packId: input.packId ?? null,
    notes: input.notes ?? "",
    status: "ready_for_hub",
    createdAt: ts,
  };
  state = { ...state, ingests: [rec, ...state.ingests] };
  return rec;
}

export function listKnowledgeIngests(userId: string): KnowledgeIngestRecord[] {
  return state.ingests.filter((i) => i.userId === userId);
}
