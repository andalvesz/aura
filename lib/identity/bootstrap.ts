/**
 * Safe bootstrap from already-confirmed system data only.
 * Never converts research history into confirmed identity.
 */

import {
  createIdentityClaimPure,
  type IdentityEngineState,
} from "@/lib/identity/engine";
import type { CreateIdentityClaimInput } from "@/lib/identity/types";

export type IdentityBootstrapInput = {
  userId: string;
  fullName?: string | null;
  email?: string | null;
  /** UI language if user selected — not inferred from content */
  preferredLanguage?: string | null;
  timezone?: string | null;
  defaultAutonomyLevel?: string | null;
  /** Explicit mission types the user created — affinity, not goals from search */
  explicitMissionTypes?: string[];
  alreadyBootstrappedKeys?: Set<string>;
};

/**
 * Returns claims to create — only confirmed/high-trust bootstrap sources.
 */
export function buildBootstrapClaimInputs(
  input: IdentityBootstrapInput
): CreateIdentityClaimInput[] {
  const skip = input.alreadyBootstrappedKeys ?? new Set<string>();
  const out: CreateIdentityClaimInput[] = [];

  const push = (c: CreateIdentityClaimInput) => {
    if (skip.has(c.key)) return;
    out.push(c);
  };

  if (input.fullName?.trim()) {
    push({
      category: "personal",
      key: "display_name",
      value: input.fullName.trim(),
      label: "Nome de exibição",
      description: "Importado do perfil de cadastro",
      sourceType: "bootstrap_profile",
      sourceReference: {
        entityType: "profile",
        entityId: input.userId,
      },
      confirmNow: true,
      confidence: 95,
      evidenceSummary: "Nome informado no cadastro",
      metadata: { bootstrap: true, importedAt: new Date().toISOString() },
    });
  }

  if (input.preferredLanguage?.trim()) {
    push({
      category: "communication",
      key: "preferred_language",
      value: input.preferredLanguage.trim(),
      label: "Idioma preferido",
      description: "Idioma configurado pelo usuário",
      sourceType: "bootstrap_settings",
      sourceReference: {
        entityType: "settings",
        entityId: "preferred_language",
      },
      confirmNow: true,
      confidence: 90,
      evidenceSummary: "Configuração explícita de idioma",
      metadata: { bootstrap: true },
    });
  }

  if (input.timezone?.trim()) {
    push({
      category: "personal",
      key: "timezone",
      value: input.timezone.trim(),
      label: "Fuso horário",
      sourceType: "bootstrap_settings",
      sourceReference: { entityType: "settings", entityId: "timezone" },
      confirmNow: true,
      confidence: 90,
      evidenceSummary: "Timezone configurado",
      metadata: { bootstrap: true },
    });
  }

  if (input.defaultAutonomyLevel?.trim()) {
    push({
      category: "preference",
      key: "autonomy_default",
      value: input.defaultAutonomyLevel.trim(),
      label: "Nível de autonomia preferido",
      description: "Preferência do Aura Brain Settings",
      sourceType: "bootstrap_settings",
      sourceReference: {
        entityType: "aura_brain_settings",
        entityId: input.userId,
      },
      confirmNow: true,
      confidence: 90,
      evidenceSummary: "Configuração de autonomia escolhida pelo usuário",
      metadata: { bootstrap: true },
    });
  }

  // Mission type affinity from explicitly created missions — LIKELY/CONFIRMED only as interest, not goals
  for (const t of input.explicitMissionTypes ?? []) {
    const typeKey = t.trim().toUpperCase();
    if (!typeKey) continue;
    push({
      category: "interest",
      key: `mission_type_affinity.${typeKey}`,
      value: typeKey,
      label: `Afinidade com missões ${typeKey}`,
      description:
        "Derivado de missões criadas explicitamente — não é objetivo automático",
      sourceType: "mission_engine",
      sourceReference: {
        entityType: "mission_type",
        entityId: typeKey,
      },
      status: "LIKELY",
      confidence: 55,
      evidenceSummary: "Usuário criou missão deste tipo",
      metadata: { bootstrap: true, notAGoal: true },
    });
  }

  return out;
}

export function applyBootstrapToState(
  state: IdentityEngineState,
  userId: string,
  input: IdentityBootstrapInput
): IdentityEngineState {
  const existingKeys = new Set(state.claims.map((c) => c.key));
  const inputs = buildBootstrapClaimInputs({
    ...input,
    alreadyBootstrappedKeys: existingKeys,
  });
  let next = state;
  for (const c of inputs) {
    const res = createIdentityClaimPure(next, userId, c);
    if (res.ok) next = res.state;
  }
  return next;
}
