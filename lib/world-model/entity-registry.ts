/**
 * Entity Type Registry — versioned, extensible.
 */

import type { WorldEntityType, WorldSensitivity } from "@/lib/world-model/types";

export type EntityTypeDefinition = {
  type: WorldEntityType;
  label: string;
  description: string;
  allowedAttributes: string[];
  sensitiveAttributes: string[];
  sourceDomains: string[];
  mergePolicy: "prefer_source_ref" | "manual" | "keep_both";
  displayPolicy: "name" | "name_type" | "name_context";
  lifecyclePolicy: "domain_driven" | "cognitive_only";
  version: number;
};

const REGISTRY: Record<string, EntityTypeDefinition> = {
  person: {
    type: "person",
    label: "Pessoa",
    description: "Indivíduo (self ou contato)",
    allowedAttributes: ["role", "preferredName"],
    sensitiveAttributes: [],
    sourceDomains: ["identity_engine", "user_explicit", "bootstrap"],
    mergePolicy: "prefer_source_ref",
    displayPolicy: "name",
    lifecyclePolicy: "cognitive_only",
    version: 1,
  },
  organization: {
    type: "organization",
    label: "Organização",
    description: "Organização genérica",
    allowedAttributes: ["sector"],
    sensitiveAttributes: [],
    sourceDomains: ["business", "workspace"],
    mergePolicy: "prefer_source_ref",
    displayPolicy: "name_type",
    lifecyclePolicy: "domain_driven",
    version: 1,
  },
  business: {
    type: "business",
    label: "Negócio",
    description: "Empresa/negócio cadastrado",
    allowedAttributes: ["status", "sector"],
    sensitiveAttributes: ["financialSummary"],
    sourceDomains: ["business", "workspace"],
    mergePolicy: "prefer_source_ref",
    displayPolicy: "name",
    lifecyclePolicy: "domain_driven",
    version: 1,
  },
  workspace: {
    type: "workspace",
    label: "Workspace",
    description: "Espaço de trabalho",
    allowedAttributes: ["role"],
    sensitiveAttributes: [],
    sourceDomains: ["workspace", "bootstrap"],
    mergePolicy: "prefer_source_ref",
    displayPolicy: "name",
    lifecyclePolicy: "domain_driven",
    version: 1,
  },
  mission: {
    type: "mission",
    label: "Missão",
    description: "Missão do Mission Engine",
    allowedAttributes: ["missionStatus", "missionType", "progress"],
    sensitiveAttributes: [],
    sourceDomains: ["mission_engine"],
    mergePolicy: "prefer_source_ref",
    displayPolicy: "name_context",
    lifecyclePolicy: "domain_driven",
    version: 1,
  },
  project: {
    type: "project",
    label: "Projeto",
    description: "Projeto ligado a missão/negócio",
    allowedAttributes: ["status"],
    sensitiveAttributes: [],
    sourceDomains: ["mission_engine", "business"],
    mergePolicy: "prefer_source_ref",
    displayPolicy: "name",
    lifecyclePolicy: "domain_driven",
    version: 1,
  },
  goal: {
    type: "goal",
    label: "Objetivo",
    description: "Meta mensurável",
    allowedAttributes: ["target", "unit"],
    sensitiveAttributes: [],
    sourceDomains: ["mission_engine", "identity_engine"],
    mergePolicy: "manual",
    displayPolicy: "name",
    lifecyclePolicy: "domain_driven",
    version: 1,
  },
  task: {
    type: "task",
    label: "Tarefa",
    description: "Tarefa de missão",
    allowedAttributes: ["taskStatus"],
    sensitiveAttributes: [],
    sourceDomains: ["mission_engine"],
    mergePolicy: "prefer_source_ref",
    displayPolicy: "name",
    lifecyclePolicy: "domain_driven",
    version: 1,
  },
  event: {
    type: "event",
    label: "Evento",
    description: "Evento temporal / episódio",
    allowedAttributes: ["occurredAt"],
    sensitiveAttributes: [],
    sourceDomains: ["memory_engine", "calendar"],
    mergePolicy: "prefer_source_ref",
    displayPolicy: "name_context",
    lifecyclePolicy: "cognitive_only",
    version: 1,
  },
  document: {
    type: "document",
    label: "Documento",
    description: "Documento estruturado",
    allowedAttributes: ["mime", "title"],
    sensitiveAttributes: [],
    sourceDomains: ["document"],
    mergePolicy: "prefer_source_ref",
    displayPolicy: "name",
    lifecyclePolicy: "domain_driven",
    version: 1,
  },
  skill: {
    type: "skill",
    label: "Habilidade",
    description: "Skill declarada/confirmada",
    allowedAttributes: ["level"],
    sensitiveAttributes: [],
    sourceDomains: ["identity_engine", "memory_engine"],
    mergePolicy: "manual",
    displayPolicy: "name",
    lifecyclePolicy: "cognitive_only",
    version: 1,
  },
  language: {
    type: "language",
    label: "Idioma",
    description: "Idioma",
    allowedAttributes: ["code"],
    sensitiveAttributes: [],
    sourceDomains: ["identity_engine"],
    mergePolicy: "manual",
    displayPolicy: "name",
    lifecyclePolicy: "cognitive_only",
    version: 1,
  },
  concept: {
    type: "concept",
    label: "Conceito",
    description: "Conceito/preferência genérica",
    allowedAttributes: ["key"],
    sensitiveAttributes: [],
    sourceDomains: ["identity_engine", "memory_engine"],
    mergePolicy: "manual",
    displayPolicy: "name",
    lifecyclePolicy: "cognitive_only",
    version: 1,
  },
  procedure: {
    type: "procedure",
    label: "Procedimento",
    description: "Processo procedural",
    allowedAttributes: ["version", "validationStatus"],
    sensitiveAttributes: [],
    sourceDomains: ["memory_engine"],
    mergePolicy: "prefer_source_ref",
    displayPolicy: "name",
    lifecyclePolicy: "cognitive_only",
    version: 1,
  },
  memory: {
    type: "memory",
    label: "Memória",
    description: "Referência a memória",
    allowedAttributes: ["memoryType"],
    sensitiveAttributes: [],
    sourceDomains: ["memory_engine"],
    mergePolicy: "prefer_source_ref",
    displayPolicy: "name",
    lifecyclePolicy: "cognitive_only",
    version: 1,
  },
  identity_claim: {
    type: "identity_claim",
    label: "Claim de identidade",
    description: "Referência a claim",
    allowedAttributes: ["category", "key"],
    sensitiveAttributes: [],
    sourceDomains: ["identity_engine"],
    mergePolicy: "prefer_source_ref",
    displayPolicy: "name",
    lifecyclePolicy: "cognitive_only",
    version: 1,
  },
  product: {
    type: "product",
    label: "Produto",
    description: "Produto de negócio",
    allowedAttributes: ["sku"],
    sensitiveAttributes: [],
    sourceDomains: ["business"],
    mergePolicy: "prefer_source_ref",
    displayPolicy: "name",
    lifecyclePolicy: "domain_driven",
    version: 1,
  },
  service: {
    type: "service",
    label: "Serviço",
    description: "Serviço oferecido",
    allowedAttributes: [],
    sensitiveAttributes: [],
    sourceDomains: ["business"],
    mergePolicy: "prefer_source_ref",
    displayPolicy: "name",
    lifecyclePolicy: "domain_driven",
    version: 1,
  },
  client: {
    type: "client",
    label: "Cliente",
    description: "Cliente do workspace",
    allowedAttributes: [],
    sensitiveAttributes: ["contact"],
    sourceDomains: ["business"],
    mergePolicy: "prefer_source_ref",
    displayPolicy: "name",
    lifecyclePolicy: "domain_driven",
    version: 1,
  },
  supplier: {
    type: "supplier",
    label: "Fornecedor",
    description: "Fornecedor",
    allowedAttributes: [],
    sensitiveAttributes: [],
    sourceDomains: ["business"],
    mergePolicy: "prefer_source_ref",
    displayPolicy: "name",
    lifecyclePolicy: "domain_driven",
    version: 1,
  },
  resource: {
    type: "resource",
    label: "Recurso",
    description: "Recurso genérico",
    allowedAttributes: ["kind"],
    sensitiveAttributes: [],
    sourceDomains: ["mission_engine", "business"],
    mergePolicy: "manual",
    displayPolicy: "name",
    lifecyclePolicy: "cognitive_only",
    version: 1,
  },
  topic: {
    type: "topic",
    label: "Tópico",
    description: "Tópico/assunto",
    allowedAttributes: [],
    sensitiveAttributes: [],
    sourceDomains: ["memory_engine"],
    mergePolicy: "manual",
    displayPolicy: "name",
    lifecyclePolicy: "cognitive_only",
    version: 1,
  },
  contact: {
    type: "contact",
    label: "Contato",
    description: "Contato externo",
    allowedAttributes: [],
    sensitiveAttributes: ["email", "phone"],
    sourceDomains: ["business", "user_explicit"],
    mergePolicy: "manual",
    displayPolicy: "name",
    lifecyclePolicy: "domain_driven",
    version: 1,
  },
  location: {
    type: "location",
    label: "Local",
    description: "Localização",
    allowedAttributes: ["place"],
    sensitiveAttributes: [],
    sourceDomains: ["memory_engine", "calendar"],
    mergePolicy: "manual",
    displayPolicy: "name",
    lifecyclePolicy: "cognitive_only",
    version: 1,
  },
  habit: {
    type: "habit",
    label: "Hábito",
    description: "Hábito",
    allowedAttributes: [],
    sensitiveAttributes: [],
    sourceDomains: ["memory_engine"],
    mergePolicy: "manual",
    displayPolicy: "name",
    lifecyclePolicy: "cognitive_only",
    version: 1,
  },
  routine: {
    type: "routine",
    label: "Rotina",
    description: "Rotina",
    allowedAttributes: [],
    sensitiveAttributes: [],
    sourceDomains: ["memory_engine"],
    mergePolicy: "manual",
    displayPolicy: "name",
    lifecyclePolicy: "cognitive_only",
    version: 1,
  },
  tool: {
    type: "tool",
    label: "Ferramenta",
    description: "Ferramenta/software",
    allowedAttributes: [],
    sensitiveAttributes: [],
    sourceDomains: ["user_explicit"],
    mergePolicy: "manual",
    displayPolicy: "name",
    lifecyclePolicy: "cognitive_only",
    version: 1,
  },
  account: {
    type: "account",
    label: "Conta",
    description: "Conta financeira (referência mínima)",
    allowedAttributes: ["kind"],
    sensitiveAttributes: ["balance"],
    sourceDomains: ["business"],
    mergePolicy: "prefer_source_ref",
    displayPolicy: "name",
    lifecyclePolicy: "domain_driven",
    version: 1,
  },
  category: {
    type: "category",
    label: "Categoria",
    description: "Categoria",
    allowedAttributes: [],
    sensitiveAttributes: [],
    sourceDomains: ["business", "memory_engine"],
    mergePolicy: "manual",
    displayPolicy: "name",
    lifecyclePolicy: "cognitive_only",
    version: 1,
  },
};

export function getEntityTypeDefinition(
  type: string
): EntityTypeDefinition | null {
  return REGISTRY[type] ?? null;
}

export function listEntityTypes(): EntityTypeDefinition[] {
  return Object.values(REGISTRY);
}

export function isKnownEntityType(type: string): boolean {
  return type in REGISTRY;
}

/** Allow known types; unknown types require explicit allowExtensibility flag. */
export function assertEntityType(
  type: string,
  allowExtension = false
): { ok: boolean; reason: string | null } {
  if (isKnownEntityType(type)) return { ok: true, reason: null };
  if (allowExtension && /^[a-z][a-z0-9_]{1,40}$/.test(type)) {
    return { ok: true, reason: null };
  }
  return {
    ok: false,
    reason: `Tipo de entidade não registrado: ${type}`,
  };
}

export function filterAllowedAttributes(
  type: WorldEntityType,
  attrs: Record<string, unknown>
): Record<string, unknown> {
  const def = getEntityTypeDefinition(type);
  if (!def) {
    // extension: keep only primitive scalars, max 8 keys
    const out: Record<string, unknown> = {};
    let i = 0;
    for (const [k, v] of Object.entries(attrs)) {
      if (i >= 8) break;
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        out[k] = v;
        i++;
      }
    }
    return out;
  }
  const out: Record<string, unknown> = {};
  for (const key of def.allowedAttributes) {
    if (key in attrs) out[key] = attrs[key];
  }
  return out;
}

export function defaultSensitivityForEntity(
  type: WorldEntityType
): WorldSensitivity {
  const def = getEntityTypeDefinition(type);
  if (def?.sensitiveAttributes.length) return "SENSITIVE";
  if (type === "person" || type === "concept") return "STANDARD";
  return "STANDARD";
}
