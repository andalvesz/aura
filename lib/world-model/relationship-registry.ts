/**
 * Relationship Type Registry — versioned, extensible.
 */

import type {
  WorldEntityType,
  WorldRelationshipType,
} from "@/lib/world-model/types";

export type RelationshipTypeDefinition = {
  type: WorldRelationshipType;
  label: string;
  inverseLabel: string;
  description: string;
  symmetric: boolean;
  transitive: boolean;
  sourceTypesAllowed: WorldEntityType[] | "*";
  targetTypesAllowed: WorldEntityType[] | "*";
  allowedContexts: string[] | "*";
  confidencePolicy: "explicit_high" | "domain_medium" | "inferred_low";
  mergePolicy: "prefer_source_ref" | "manual";
  allowSelfLoop: boolean;
  version: number;
};

function def(
  partial: RelationshipTypeDefinition
): RelationshipTypeDefinition {
  return partial;
}

const REGISTRY: Record<string, RelationshipTypeDefinition> = {
  SELF: def({
    type: "SELF",
    label: "é",
    inverseLabel: "é",
    description: "Auto-referência da pessoa",
    symmetric: true,
    transitive: false,
    sourceTypesAllowed: ["person"],
    targetTypesAllowed: ["person"],
    allowedContexts: "*",
    confidencePolicy: "explicit_high",
    mergePolicy: "prefer_source_ref",
    allowSelfLoop: true,
    version: 1,
  }),
  OWNS: def({
    type: "OWNS",
    label: "possui",
    inverseLabel: "é possuído por",
    description: "Propriedade",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["person", "organization", "business", "workspace"],
    targetTypesAllowed: "*",
    allowedContexts: "*",
    confidencePolicy: "domain_medium",
    mergePolicy: "prefer_source_ref",
    allowSelfLoop: false,
    version: 1,
  }),
  FOUNDER_OF: def({
    type: "FOUNDER_OF",
    label: "fundou",
    inverseLabel: "fundado por",
    description: "Fundador — exige declaração explícita",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["person"],
    targetTypesAllowed: ["business", "organization"],
    allowedContexts: ["business", "professional", "global"],
    confidencePolicy: "explicit_high",
    mergePolicy: "manual",
    allowSelfLoop: false,
    version: 1,
  }),
  MEMBER_OF: def({
    type: "MEMBER_OF",
    label: "é membro de",
    inverseLabel: "tem membro",
    description: "Membership de workspace/org",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["person"],
    targetTypesAllowed: ["workspace", "organization", "business"],
    allowedContexts: "*",
    confidencePolicy: "domain_medium",
    mergePolicy: "prefer_source_ref",
    allowSelfLoop: false,
    version: 1,
  }),
  HAS_MISSION: def({
    type: "HAS_MISSION",
    label: "tem missão",
    inverseLabel: "é missão de",
    description: "Pessoa/workspace possui missão",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["person", "workspace"],
    targetTypesAllowed: ["mission"],
    allowedContexts: "*",
    confidencePolicy: "domain_medium",
    mergePolicy: "prefer_source_ref",
    allowSelfLoop: false,
    version: 1,
  }),
  HAS_GOAL: def({
    type: "HAS_GOAL",
    label: "tem objetivo",
    inverseLabel: "é objetivo de",
    description: "Objetivo vinculado",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["person", "mission", "project"],
    targetTypesAllowed: ["goal"],
    allowedContexts: "*",
    confidencePolicy: "explicit_high",
    mergePolicy: "manual",
    allowSelfLoop: false,
    version: 1,
  }),
  HAS_SKILL: def({
    type: "HAS_SKILL",
    label: "tem habilidade",
    inverseLabel: "é habilidade de",
    description: "Skill confirmada",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["person"],
    targetTypesAllowed: ["skill"],
    allowedContexts: "*",
    confidencePolicy: "explicit_high",
    mergePolicy: "manual",
    allowSelfLoop: false,
    version: 1,
  }),
  LEARNING: def({
    type: "LEARNING",
    label: "aprende",
    inverseLabel: "é aprendido por",
    description: "Aprendizado ativo",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["person"],
    targetTypesAllowed: ["language", "skill", "topic", "concept"],
    allowedContexts: "*",
    confidencePolicy: "explicit_high",
    mergePolicy: "manual",
    allowSelfLoop: false,
    version: 1,
  }),
  PREFERS: def({
    type: "PREFERS",
    label: "prefere",
    inverseLabel: "é preferido por",
    description: "Preferência confirmada",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["person"],
    targetTypesAllowed: ["concept", "topic", "tool", "routine"],
    allowedContexts: "*",
    confidencePolicy: "explicit_high",
    mergePolicy: "manual",
    allowSelfLoop: false,
    version: 1,
  }),
  INTERESTED_IN: def({
    type: "INTERESTED_IN",
    label: "tem interesse em",
    inverseLabel: "interessa a",
    description: "Interesse — nunca de pesquisa isolada",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["person"],
    targetTypesAllowed: ["topic", "concept", "skill"],
    allowedContexts: "*",
    confidencePolicy: "explicit_high",
    mergePolicy: "manual",
    allowSelfLoop: false,
    version: 1,
  }),
  DEPENDS_ON: def({
    type: "DEPENDS_ON",
    label: "depende de",
    inverseLabel: "bloqueia",
    description: "Dependência",
    symmetric: false,
    transitive: true,
    sourceTypesAllowed: ["mission", "task", "goal", "project"],
    targetTypesAllowed: ["mission", "task", "goal", "project", "resource"],
    allowedContexts: "*",
    confidencePolicy: "domain_medium",
    mergePolicy: "prefer_source_ref",
    allowSelfLoop: false,
    version: 1,
  }),
  BLOCKED_BY: def({
    type: "BLOCKED_BY",
    label: "bloqueado por",
    inverseLabel: "bloqueia",
    description: "Bloqueio",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["mission", "task"],
    targetTypesAllowed: "*",
    allowedContexts: "*",
    confidencePolicy: "domain_medium",
    mergePolicy: "prefer_source_ref",
    allowSelfLoop: false,
    version: 1,
  }),
  PART_OF: def({
    type: "PART_OF",
    label: "faz parte de",
    inverseLabel: "contém",
    description: "Composição",
    symmetric: false,
    transitive: true,
    sourceTypesAllowed: ["task", "goal", "project", "document"],
    targetTypesAllowed: ["mission", "project", "business"],
    allowedContexts: "*",
    confidencePolicy: "domain_medium",
    mergePolicy: "prefer_source_ref",
    allowSelfLoop: false,
    version: 1,
  }),
  EVIDENCED_BY: def({
    type: "EVIDENCED_BY",
    label: "evidenciado por",
    inverseLabel: "evidencia",
    description: "Evidência de memória/documento",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: "*",
    targetTypesAllowed: ["memory", "document", "event", "identity_claim"],
    allowedContexts: "*",
    confidencePolicy: "domain_medium",
    mergePolicy: "prefer_source_ref",
    allowSelfLoop: false,
    version: 1,
  }),
  DOCUMENTS: def({
    type: "DOCUMENTS",
    label: "documenta",
    inverseLabel: "documentado por",
    description: "Documento relacionado",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["document"],
    targetTypesAllowed: "*",
    allowedContexts: "*",
    confidencePolicy: "domain_medium",
    mergePolicy: "prefer_source_ref",
    allowSelfLoop: false,
    version: 1,
  }),
  DERIVED_FROM: def({
    type: "DERIVED_FROM",
    label: "derivado de",
    inverseLabel: "origina",
    description: "Derivação cognitiva",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: "*",
    targetTypesAllowed: "*",
    allowedContexts: "*",
    confidencePolicy: "inferred_low",
    mergePolicy: "manual",
    allowSelfLoop: false,
    version: 1,
  }),
  REPRESENTS: def({
    type: "REPRESENTS",
    label: "representa",
    inverseLabel: "representado por",
    description: "Projeção representa fonte",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["memory", "identity_claim"],
    targetTypesAllowed: "*",
    allowedContexts: "*",
    confidencePolicy: "domain_medium",
    mergePolicy: "prefer_source_ref",
    allowSelfLoop: false,
    version: 1,
  }),
  SUPERSEDES: def({
    type: "SUPERSEDES",
    label: "substitui",
    inverseLabel: "substituído por",
    description: "Supersessão",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: "*",
    targetTypesAllowed: "*",
    allowedContexts: "*",
    confidencePolicy: "explicit_high",
    mergePolicy: "manual",
    allowSelfLoop: false,
    version: 1,
  }),
  CONTRADICTS: def({
    type: "CONTRADICTS",
    label: "contradiz",
    inverseLabel: "contradiz",
    description: "Conflito",
    symmetric: true,
    transitive: false,
    sourceTypesAllowed: "*",
    targetTypesAllowed: "*",
    allowedContexts: "*",
    confidencePolicy: "inferred_low",
    mergePolicy: "manual",
    allowSelfLoop: false,
    version: 1,
  }),
  RELATED_TO: def({
    type: "RELATED_TO",
    label: "relacionado a",
    inverseLabel: "relacionado a",
    description: "Fallback controlado — evitar como padrão",
    symmetric: true,
    transitive: false,
    sourceTypesAllowed: "*",
    targetTypesAllowed: "*",
    allowedContexts: "*",
    confidencePolicy: "inferred_low",
    mergePolicy: "manual",
    allowSelfLoop: false,
    version: 1,
  }),
  CREATED: def({
    type: "CREATED",
    label: "criou",
    inverseLabel: "criado por",
    description: "Criação",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["person"],
    targetTypesAllowed: "*",
    allowedContexts: "*",
    confidencePolicy: "domain_medium",
    mergePolicy: "prefer_source_ref",
    allowSelfLoop: false,
    version: 1,
  }),
  WORKS_ON: def({
    type: "WORKS_ON",
    label: "trabalha em",
    inverseLabel: "tem contribuinte",
    description: "Trabalho em projeto/missão",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["person"],
    targetTypesAllowed: ["mission", "project", "business"],
    allowedContexts: "*",
    confidencePolicy: "domain_medium",
    mergePolicy: "prefer_source_ref",
    allowSelfLoop: false,
    version: 1,
  }),
  WORKS_FOR: def({
    type: "WORKS_FOR",
    label: "trabalha para",
    inverseLabel: "emprega",
    description: "Vínculo profissional",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["person"],
    targetTypesAllowed: ["business", "organization"],
    allowedContexts: ["professional", "business"],
    confidencePolicy: "explicit_high",
    mergePolicy: "manual",
    allowSelfLoop: false,
    version: 1,
  }),
  MANAGES: def({
    type: "MANAGES",
    label: "gerencia",
    inverseLabel: "gerenciado por",
    description: "Gestão",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["person"],
    targetTypesAllowed: ["project", "mission", "business", "workspace"],
    allowedContexts: "*",
    confidencePolicy: "domain_medium",
    mergePolicy: "prefer_source_ref",
    allowSelfLoop: false,
    version: 1,
  }),
  PARTICIPATES_IN: def({
    type: "PARTICIPATES_IN",
    label: "participa de",
    inverseLabel: "tem participante",
    description: "Participação em evento/missão",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["person"],
    targetTypesAllowed: ["event", "mission", "project"],
    allowedContexts: "*",
    confidencePolicy: "domain_medium",
    mergePolicy: "prefer_source_ref",
    allowSelfLoop: false,
    version: 1,
  }),
  USES: def({
    type: "USES",
    label: "usa",
    inverseLabel: "usado por",
    description: "Uso de ferramenta/recurso",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["person", "business", "mission"],
    targetTypesAllowed: ["tool", "resource", "product", "service"],
    allowedContexts: "*",
    confidencePolicy: "domain_medium",
    mergePolicy: "manual",
    allowSelfLoop: false,
    version: 1,
  }),
  CONTRIBUTES_TO: def({
    type: "CONTRIBUTES_TO",
    label: "contribui para",
    inverseLabel: "recebe contribuição de",
    description: "Contribuição",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["task", "goal", "resource"],
    targetTypesAllowed: ["mission", "goal", "project"],
    allowedContexts: "*",
    confidencePolicy: "domain_medium",
    mergePolicy: "prefer_source_ref",
    allowSelfLoop: false,
    version: 1,
  }),
  SUPPORTS: def({
    type: "SUPPORTS",
    label: "suporta",
    inverseLabel: "suportado por",
    description: "Suporte",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: "*",
    targetTypesAllowed: "*",
    allowedContexts: "*",
    confidencePolicy: "inferred_low",
    mergePolicy: "manual",
    allowSelfLoop: false,
    version: 1,
  }),
  LOCATED_IN: def({
    type: "LOCATED_IN",
    label: "localizado em",
    inverseLabel: "contém",
    description: "Localização",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["person", "business", "event", "organization"],
    targetTypesAllowed: ["location"],
    allowedContexts: "*",
    confidencePolicy: "domain_medium",
    mergePolicy: "manual",
    allowSelfLoop: false,
    version: 1,
  }),
  SCHEDULED_FOR: def({
    type: "SCHEDULED_FOR",
    label: "agendado para",
    inverseLabel: "agenda",
    description: "Agendamento",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["mission", "task", "event"],
    targetTypesAllowed: ["event"],
    allowedContexts: "*",
    confidencePolicy: "domain_medium",
    mergePolicy: "prefer_source_ref",
    allowSelfLoop: false,
    version: 1,
  }),
  PRODUCES: def({
    type: "PRODUCES",
    label: "produz",
    inverseLabel: "produzido por",
    description: "Produção",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["business", "person", "procedure"],
    targetTypesAllowed: ["product", "service", "document"],
    allowedContexts: "*",
    confidencePolicy: "domain_medium",
    mergePolicy: "prefer_source_ref",
    allowSelfLoop: false,
    version: 1,
  }),
  CONSUMES: def({
    type: "CONSUMES",
    label: "consome",
    inverseLabel: "consumido por",
    description: "Consumo",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["business", "person", "mission"],
    targetTypesAllowed: ["resource", "product", "service"],
    allowedContexts: "*",
    confidencePolicy: "domain_medium",
    mergePolicy: "manual",
    allowSelfLoop: false,
    version: 1,
  }),
  GENERATES: def({
    type: "GENERATES",
    label: "gera",
    inverseLabel: "gerado por",
    description: "Geração",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: "*",
    targetTypesAllowed: "*",
    allowedContexts: "*",
    confidencePolicy: "inferred_low",
    mergePolicy: "manual",
    allowSelfLoop: false,
    version: 1,
  }),
  SERVES: def({
    type: "SERVES",
    label: "atende",
    inverseLabel: "atendido por",
    description: "Atendimento a cliente",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["business", "service", "person"],
    targetTypesAllowed: ["client"],
    allowedContexts: ["business"],
    confidencePolicy: "domain_medium",
    mergePolicy: "prefer_source_ref",
    allowSelfLoop: false,
    version: 1,
  }),
  PROVIDED_BY: def({
    type: "PROVIDED_BY",
    label: "fornecido por",
    inverseLabel: "fornece",
    description: "Fornecimento",
    symmetric: false,
    transitive: false,
    sourceTypesAllowed: ["product", "service", "resource"],
    targetTypesAllowed: ["supplier", "business"],
    allowedContexts: ["business"],
    confidencePolicy: "domain_medium",
    mergePolicy: "prefer_source_ref",
    allowSelfLoop: false,
    version: 1,
  }),
  ASSOCIATED_WITH: def({
    type: "ASSOCIATED_WITH",
    label: "associado a",
    inverseLabel: "associado a",
    description: "Associação fraca",
    symmetric: true,
    transitive: false,
    sourceTypesAllowed: "*",
    targetTypesAllowed: "*",
    allowedContexts: "*",
    confidencePolicy: "inferred_low",
    mergePolicy: "manual",
    allowSelfLoop: false,
    version: 1,
  }),
};

export function getRelationshipTypeDefinition(
  type: string
): RelationshipTypeDefinition | null {
  return REGISTRY[type] ?? null;
}

export function listRelationshipTypes(): RelationshipTypeDefinition[] {
  return Object.values(REGISTRY);
}

export function isKnownRelationshipType(type: string): boolean {
  return type in REGISTRY;
}

function typeAllowed(
  allowed: WorldEntityType[] | "*",
  actual: string
): boolean {
  if (allowed === "*") return true;
  return allowed.includes(actual as WorldEntityType);
}

export function assertRelationshipCompatibility(input: {
  relationshipType: string;
  sourceEntityType: string;
  targetEntityType: string;
  context?: string;
  sourceEntityId?: string;
  targetEntityId?: string;
}): { ok: boolean; reason: string | null } {
  const def = getRelationshipTypeDefinition(input.relationshipType);
  if (!def) {
    return {
      ok: false,
      reason: `Tipo de relação não registrado: ${input.relationshipType}`,
    };
  }
  if (
    input.sourceEntityId &&
    input.targetEntityId &&
    input.sourceEntityId === input.targetEntityId &&
    !def.allowSelfLoop
  ) {
    return {
      ok: false,
      reason: `Self-loop não permitido para ${input.relationshipType}`,
    };
  }
  if (!typeAllowed(def.sourceTypesAllowed, input.sourceEntityType)) {
    return {
      ok: false,
      reason: `${input.relationshipType} não permite source ${input.sourceEntityType}`,
    };
  }
  if (!typeAllowed(def.targetTypesAllowed, input.targetEntityType)) {
    return {
      ok: false,
      reason: `${input.relationshipType} não permite target ${input.targetEntityType}`,
    };
  }
  if (
    def.allowedContexts !== "*" &&
    input.context &&
    !def.allowedContexts.includes(input.context)
  ) {
    return {
      ok: false,
      reason: `Contexto ${input.context} não permitido para ${input.relationshipType}`,
    };
  }
  return { ok: true, reason: null };
}
