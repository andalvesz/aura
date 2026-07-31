/**
 * Experience modes — presets of capabilities, not fixed personas.
 * No Anderson-specific rules.
 */

import type { ExperienceMode } from "@/lib/capabilities/types";

export type ExperiencePreset = {
  mode: ExperienceMode;
  label: string;
  description: string;
  suggestedCapabilityIds: string[];
  suggestedSkillIds: string[];
  initialNavigationIds: string[];
  initialWidgetIds: string[];
  suggestedTemplateIds: string[];
};

export const EXPERIENCE_PRESETS: ExperiencePreset[] = [
  {
    mode: "PERSONAL",
    label: "Pessoal",
    description: "Rotina, saúde, finanças e missões pessoais",
    suggestedCapabilityIds: [
      "module.financeiro",
      "module.saude",
      "module.missions",
      "module.calendario",
    ],
    suggestedSkillIds: [
      "skill.daily-planning",
      "skill.health-routine",
      "skill.financial-organization",
      "skill.mission-planning",
    ],
    initialNavigationIds: ["missions", "financeiro", "saude", "calendario"],
    initialWidgetIds: ["home", "missions", "timeline", "notifications"],
    suggestedTemplateIds: ["tpl.organize-personal-routine", "tpl.improve-health"],
  },
  {
    mode: "CREATOR",
    label: "Creator",
    description: "Conteúdo, knowledge e preparação de ofertas",
    suggestedCapabilityIds: ["module.creator", "module.knowledge", "module.projects"],
    suggestedSkillIds: [
      "skill.content-preparation",
      "skill.knowledge-organization",
      "skill.project-review",
    ],
    initialNavigationIds: ["creator", "knowledge-hub", "projects"],
    initialWidgetIds: ["home", "projects", "knowledge", "timeline"],
    suggestedTemplateIds: ["tpl.launch-project", "tpl.learn-skill"],
  },
  {
    mode: "BUSINESS",
    label: "Negócios",
    description: "Business hub, recomendações e expert brain",
    suggestedCapabilityIds: [
      "module.business",
      "module.recommendations",
      "module.expert-brain",
      "module.scenarios",
    ],
    suggestedSkillIds: [
      "skill.business-idea-preparation",
      "skill.project-review",
    ],
    initialNavigationIds: ["business", "recommendations", "expert-brain"],
    initialWidgetIds: ["home", "business", "recommendations", "timeline"],
    suggestedTemplateIds: ["tpl.validate-business-idea", "tpl.launch-project"],
  },
  {
    mode: "TEAM",
    label: "Equipe",
    description: "Workspace, permissões e colaboração",
    suggestedCapabilityIds: [
      "core.workspaces",
      "core.permissions",
      "module.projects",
      "module.automations",
    ],
    suggestedSkillIds: ["skill.workspace-collaboration", "skill.project-review"],
    initialNavigationIds: ["workspace", "projects", "automations"],
    initialWidgetIds: ["home", "projects", "notifications", "timeline"],
    suggestedTemplateIds: ["tpl.organize-team", "tpl.launch-project"],
  },
  {
    mode: "CUSTOM",
    label: "Personalizado",
    description: "Escolha livre de módulos e skills",
    suggestedCapabilityIds: [],
    suggestedSkillIds: [],
    initialNavigationIds: [],
    initialWidgetIds: ["home", "discovery", "timeline", "notifications"],
    suggestedTemplateIds: [],
  },
];

export function getExperiencePreset(mode: ExperienceMode): ExperiencePreset {
  return EXPERIENCE_PRESETS.find((p) => p.mode === mode) ?? EXPERIENCE_PRESETS[4]!;
}
