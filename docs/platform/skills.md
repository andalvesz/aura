# Skills

Skills agrupam capacidades existentes. Não duplicam lógica.

## Skills V1

| Skill | Agrupa |
|-------|--------|
| Daily Planning | calendário, missões, planner |
| Project Review | projects, agents, prioritization |
| Knowledge Organization | knowledge, memory |
| Business Idea Preparation | business, agents, recommendations |
| Financial Organization | financeiro |
| Health Routine | saúde |
| Mission Planning | missões, planner |
| Content Preparation | creator |
| Workspace Collaboration | workspaces, permissions |
| Alvesz Experience Skill | workspace.alvesz (privada) |

## Visibilidade

`PRIVATE` · `WORKSPACE` · `SYSTEM` · `FUTURE_PUBLIC` (sem marketplace nesta sprint)

## Skill Center

Rota: `/dashboard/skills`

Fluxo: selecionar → capacidades → permissões → riscos → deps → confirmar → instalar → configurar → ativar.

## APIs

- `installSkillPure` / `enableSkillPure` / `disableSkillPure` / `uninstallSkillPure`
- `previewSkillInstall`
- `skillCenterSections`
