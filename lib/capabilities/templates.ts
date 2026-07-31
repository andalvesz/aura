/**
 * Generic system templates — no Disney, Alvesz, or tenant-specific data.
 */

import type { PlatformTemplate } from "@/lib/capabilities/types";
import { newId, nowIso, pushAudit, type PlatformState } from "@/lib/capabilities/store";

export const SYSTEM_TEMPLATES: PlatformTemplate[] = [
  {
    id: "tpl.organize-personal-routine",
    kind: "mission",
    name: "Organizar rotina pessoal",
    description: "Missão genérica para estruturar rotina diária",
    version: "1.0.0",
    category: "personal",
    payload: { steps: ["Definir horários", "Listar hábitos", "Revisar semanalmente"] },
    requiredCapabilities: ["module.missions", "module.calendario"],
    system: true,
    status: "STABLE",
  },
  {
    id: "tpl.launch-project",
    kind: "project",
    name: "Lançar um projeto",
    description: "Projeto com fases de kickoff, execução e revisão",
    version: "1.0.0",
    category: "projects",
    payload: { phases: ["Kickoff", "Execução", "Revisão"] },
    requiredCapabilities: ["module.projects", "core.planner"],
    system: true,
    status: "STABLE",
  },
  {
    id: "tpl.validate-business-idea",
    kind: "plan",
    name: "Validar ideia de negócio",
    description: "Plano genérico de validação",
    version: "1.0.0",
    category: "business",
    payload: { steps: ["Hipótese", "Público", "Oferta", "Teste"] },
    requiredCapabilities: ["module.business", "core.decision-support"],
    system: true,
    status: "STABLE",
  },
  {
    id: "tpl.plan-travel",
    kind: "mission",
    name: "Planejar viagem",
    description: "Checklist genérico de viagem",
    version: "1.0.0",
    category: "travel",
    payload: { steps: ["Datas", "Orçamento", "Documentos", "Roteiro"] },
    requiredCapabilities: ["module.viagens"],
    system: true,
    status: "STABLE",
  },
  {
    id: "tpl.learn-skill",
    kind: "plan",
    name: "Aprender habilidade",
    description: "Plano de aprendizado genérico",
    version: "1.0.0",
    category: "learning",
    payload: { steps: ["Objetivo", "Recursos", "Prática", "Revisão"] },
    requiredCapabilities: ["module.learning", "module.knowledge"],
    system: true,
    status: "STABLE",
  },
  {
    id: "tpl.improve-health",
    kind: "mission",
    name: "Melhorar saúde",
    description: "Rotina de saúde genérica",
    version: "1.0.0",
    category: "health",
    payload: { steps: ["Baseline", "Hábitos", "Treino", "Revisão"] },
    requiredCapabilities: ["module.saude"],
    system: true,
    status: "STABLE",
  },
  {
    id: "tpl.organize-team",
    kind: "workspace",
    name: "Organizar equipe",
    description: "Setup genérico de workspace em equipe",
    version: "1.0.0",
    category: "team",
    payload: { steps: ["Nome", "Papéis", "Objetivos", "Módulos"] },
    requiredCapabilities: ["core.workspaces", "core.permissions"],
    system: true,
    status: "STABLE",
  },
];

export function ensureSystemTemplates(state: PlatformState): PlatformState {
  const ids = new Set(state.templates.map((t) => t.id));
  const missing = SYSTEM_TEMPLATES.filter((t) => !ids.has(t.id));
  if (!missing.length) return state;
  return { ...state, templates: [...state.templates, ...missing] };
}

export function listTemplates(state: PlatformState): PlatformTemplate[] {
  return ensureSystemTemplates(state).templates.filter(
    (t) => !/disney|alvesz|cons[oó]rcio/i.test(`${t.id} ${t.name} ${t.description}`)
  );
}

export function installTemplatePure(
  state: PlatformState,
  templateId: string,
  userId: string,
  workspaceId: string | null
): { state: PlatformState; ok: boolean } {
  const s0 = ensureSystemTemplates(state);
  const tpl = s0.templates.find((t) => t.id === templateId);
  if (!tpl) return { state: s0, ok: false };
  const s = pushAudit(s0, {
    event: "template_installed",
    userId,
    workspaceId,
    subjectType: "template",
    subjectId: templateId,
    summary: `Template ${tpl.name}`,
    metadata: { kind: tpl.kind },
    createdAt: nowIso(),
  });
  return { state: s, ok: true };
}

export function createUserTemplatePure(
  state: PlatformState,
  partial: Omit<PlatformTemplate, "id" | "system" | "status" | "version"> & {
    version?: string;
  },
  userId: string,
  workspaceId: string | null
): PlatformState {
  if (/disney|alvesz/i.test(`${partial.name} ${partial.description}`)) {
    return state;
  }
  const tpl: PlatformTemplate = {
    id: newId("tpl"),
    version: partial.version ?? "1.0.0",
    system: false,
    status: "STABLE",
    kind: partial.kind,
    name: partial.name,
    description: partial.description,
    category: partial.category,
    payload: partial.payload,
    requiredCapabilities: partial.requiredCapabilities,
  };
  let s: PlatformState = { ...state, templates: [...state.templates, tpl] };
  s = pushAudit(s, {
    event: "template_created",
    userId,
    workspaceId,
    subjectType: "template",
    subjectId: tpl.id,
    summary: tpl.name,
    metadata: { kind: tpl.kind },
  });
  return s;
}
