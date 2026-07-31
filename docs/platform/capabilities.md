# Capability Registry

Sprint 10.0 — capacidades instaláveis do Aura Brain.

## Conceito

O **Capability Registry** (`lib/capabilities/`) declara capacidades em código. Somente IDs registrados podem ser instalados. Não há engines paralelos: actions, agents e automations continuam nos registries existentes.

## Tipos

`CORE` · `MODULE` · `SKILL` · `AGENT` · `AUTOMATION` · `TEMPLATE` · `INTEGRATION` · `VIEW` · `CONNECTOR`

## Core (não desinstalável)

Autenticação, profiles, workspaces, permissions, Aura Home, Orchestrator, Identity, Memory, World Model, Cognitive, Discovery, Decision Support, Planner base, Audit, settings, busca, notificações, segurança, Command Center.

## Opcionais

Financeiro, Saúde, Idiomas, Viagens, Knowledge, Projects, Business, Expert Brain, Scenarios, Prioritization, Recommendations, Automations, Agents, Learning, Creator, Missões, Calendário, Skill Center.

**Alvesz Experience** é `PRIVATE_WORKSPACE` (slug `alvesz`) — não aparece como módulo genérico.

**Consórcios** está excluído e rejeitado no registry.

## Ciclo de vida

`DRAFT` → `BETA` → `STABLE` → `DEPRECATED` → `DISABLED` → `REMOVED`

Deprecated continua funcionando com aviso e substituta.

## APIs principais

- `ensurePlatformRegistries()`
- `installCapabilityPure` / `enable` / `disable` / `uninstall`
- `resolveCapabilities` / `isCapabilityEffectivelyEnabled`
- `buildDynamicNavigation`

## Segurança

- Viewer não instala
- Core protegido
- Dependências validadas antes de ativar
- Feature flags não substituem autorização
