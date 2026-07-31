# Sprint 10.0 — SaaS & Skills Platform Foundation

**Status:** ✅ Concluída (fundação)  
**Data:** 2026-07-31  
**Versão da plataforma:** 10.0.0  
**Formato de config:** `aura-platform-config/v1`

---

## 1. Resumo executivo

A Sprint 10.0 estabelece a **fundação de plataforma SaaS e Skills** do Aura Brain: registries em código, fluxos puros de instalação/ativação, resolver de capacidades e skills, onboarding, templates, export/import, metering, entitlements, admin, branding e integração com Command Center e Aura Home — **sem** pagamentos, marketplace ou alterações no cognitive kernel.

O estado operacional V1 persiste **em memória no cliente** (`lib/capabilities/store.ts`), espelhando o padrão do Learning store; a migration SQL prepara persistência Supabase com RLS, mas **não deve ser aplicada automaticamente em produção**.

**Definition of Done (fundação):** ✅ Atendida. Registries, funções puras, rotas de UI, testes `test:platform`, documentação em `docs/platform/` e checklist de prontidão SaaS entregues. Persistência DB e enforcement comercial ficam para sprints posteriores.

**Fora de escopo (10.0):** billing/payments, marketplace público, mudanças em engines cognitivos, módulo Consórcios (excluído), Alvesz isolado como capability/skill privada.

---

## 2. Auditoria

| Área | Resultado |
|------|-----------|
| Superfícies do produto mapeadas | ✅ `BUILTIN_CAPABILITIES` + `CAPABILITY_AUDIT_MATRIX` |
| Consórcios | ✅ Excluído (`EXCLUDED_CAPABILITY_IDS`, rejeição no registry) |
| Alvesz | ✅ `workspace.alvesz` + `skill.alvesz-experience` — apenas slug `alvesz` |
| Duplicação de engines | ✅ Skills agrupam capabilities existentes; sem lógica duplicada |
| Hardcodes de usuário | ⚠️ **Parcial** — fallbacks `"Anderson"` / contextos legados em APIs e módulos (ver §27) |
| Templates genéricos | ✅ Teste garante ausência de Disney/Alvesz em nomes de template |
| Cognitive kernel | ✅ Sem alterações de contrato |

Matriz de auditoria exportada via `CAPABILITY_AUDIT_MATRIX` (core vs optional, customizável, compartilhável, desabilitável).

---

## 3. Arquitetura

```
UI (Skill Center, Capabilities, Onboarding, Admin)
        ↓
lib/capabilities/index.ts          ← API pública Sprint 10.0
  catalog / skills-catalog         ← definições em código (source of truth)
  registry                         ← registro e listagem
  store (V1 in-memory)             ← installations, flags, audit, metering…
  resolver                         ← effective enabled + bootstrap core
  installation / lifecycle / configuration / validation
  dependencies / permissions
  feature-flags / entitlements / metering / branding
  templates / onboarding / experience-modes / navigation
  export-import / admin / saas-readiness
  command-center / home-widgets
        ↓
Orchestrator, Action Registry, módulos existentes (sem fork)
        ↓
Supabase (opcional) — migration 20260731320000_* (manual prod)
```

Princípio: **somente IDs registrados** podem ser instalados; feature flags **não substituem** autorização.

---

## 4. Capability Registry

- **Local:** `lib/capabilities/catalog.ts`, `registry.ts`, `types.ts`
- **Tipos:** `CORE`, `MODULE`, `SKILL`, `AGENT`, `AUTOMATION`, `TEMPLATE`, `INTEGRATION`, `VIEW`, `CONNECTOR`
- **Ciclo de vida:** `DRAFT` → `BETA` → `STABLE` → `DEPRECATED` → `DISABLED` → `REMOVED`
- **APIs:** `ensurePlatformRegistries()`, `listCoreCapabilities()`, `listOptionalCapabilities()`, `getCapability()`, `registerCapability()` (com guardas Consórcios)
- **Core:** auth, profiles, workspaces, permissions, aura-home, orchestrator, identity, memory, world-model, cognitive, discovery, decision-support, planner, audit, settings, search, notifications, security, command-center, etc.
- **Opcionais:** financeiro, saúde, idiomas, viagens, knowledge, projects, business, expert-brain, scenarios, prioritization, recommendations, automations, agents, learning, creator, missões, calendário, skill-center, …
- **Doc:** `docs/platform/capabilities.md`

---

## 5. Skill Registry

- **Local:** `lib/capabilities/skills-catalog.ts`, `registry.ts`
- **Modelo:** Skill = pacote versionado que referencia `capabilities[]` e `requiredCapabilities[]`
- **Visibilidade:** `SYSTEM`, `WORKSPACE`, `FUTURE_PUBLIC` (filtrada em listagens públicas)
- **APIs:** `listSkills()`, `listPublicSkills({ includePrivate, workspaceSlug })`, `getSkillBySlug()`, `previewSkillInstall()`
- **Doc:** `docs/platform/skills.md`

---

## 6. Core

Capabilities **core** são instaladas via `bootstrapCoreInstallations`, **não desinstaláveis** (`assertNotCoreUninstall`), `defaultEnabled: true`, protegidas em mutações de viewer.

Incluem a cascata mínima para Aura Home, orchestrator e engines já existentes (Identity, Memory, World Model, Cognitive, Discovery, Decision Support, Planner base).

---

## 7. Skills V1

| Slug | Nome | Notas |
|------|------|--------|
| `daily-planning` | Daily Planning | Calendário, missões, planner |
| `project-review` | Project Review | Projects, agents, prioritization |
| `knowledge-organization` | Knowledge Organization | Knowledge + memory |
| `business-idea-preparation` | Business Idea Preparation | Business, agents, recommendations |
| `financial-organization` | Financial Organization | Financeiro |
| `health-routine` | Health Routine | Saúde |
| `mission-planning` | Mission Planning | Missões + planner |
| `content-preparation` | Content Preparation | Creator |
| `workspace-collaboration` | Workspace Collaboration | Workspaces + permissions |
| `alvesz-experience` | Alvesz Experience Skill | **Privada** — slug `alvesz` only |

Todas em `1.0.0`, `authorType: SYSTEM` (Alvesz: `INTERNAL`), `uninstallable: true` (exceto política futura para core implícito via capabilities).

---

## 8. Installation flow

Funções puras em `installation.ts`:

1. **Install** — valida permissões, versão declarada, schema de config, dependências e conflitos
2. **Enable / Disable** — mutação com audit
3. **Uninstall** — bloqueado para core; skills desinstalam instalação associada
4. **Preview** — `previewSkillInstall()` expõe issues antes de confirmar

Eventos de audit: `dependency_failed`, instalações com `status: error` aparecem no snapshot admin.

Integração Command Center: propostas com `requiresConfirmation` para ativação de skills.

---

## 9. Dependencies

- **Arquivo:** `dependencies.ts`
- **Capability:** `resolveCapabilityDependencies()` — missing, optional, conflicts
- **Skill:** `resolveSkillDependencies()` — required capabilities + skill deps
- **Acesso:** `validateCapabilityAccess`, `validateSkillAccess`, `canActivate`, `roleSatisfies`
- Dependências declaradas no catálogo (ex.: opcionais exigem `core.auth`; knowledge exige world-model via skill)

---

## 10. Feature flags

- **Arquivo:** `feature-flags.ts`
- Escopos por usuário/workspace; `setFeatureFlagPure`, `isFeatureEnabled`
- **`rejectClientFlagOverride`** — cliente não pode elevar privilégio via flag
- Flags associadas a capabilities no catálogo; **não substituem RBAC**
- **Doc:** `docs/platform/feature-flags.md`

---

## 11. Onboarding

- **Arquivo:** `onboarding.ts`
- Fluxos: `completePersonalOnboardingPure`, `completeWorkspaceOnboardingPure`
- `suggestFromOnboarding` → skills/capabilities sugeridas
- `getOnboardingStatus` — sem mock data
- **Rota:** `/dashboard/onboarding` (`platform-onboarding-client.tsx`)

---

## 12. Experience modes

- **Arquivo:** `experience-modes.ts`
- Presets `EXPERIENCE_PRESETS` + `getExperiencePreset`
- Ajustam densidade/foco da experiência (foundation para personalização SaaS)

---

## 13. Navigation

- **Arquivo:** `navigation.ts`
- `NAV_CAPABILITY_MAP`, `buildDynamicNavigation`, `setNavigationOrderPure`
- `enabledModuleIds`, `capabilityIdForNavItem`
- Itens de nav declarados nas capabilities (`navigationItems`); Alvesz em seção isolada
- Widgets Aura Home filtrados por `filterHomeWidgetsByCapabilities` (`home-widgets.ts`)

---

## 14. Templates

- **Arquivo:** `templates.ts`
- `SYSTEM_TEMPLATES` (≥7 genéricos), `ensureSystemTemplates`, `installTemplatePure`, `createUserTemplatePure`
- Sem branding Disney/Alvesz nos nomes de template (teste automatizado)
- **Doc:** `docs/platform/templates.md`

---

## 15. Private workspace skills

- Capability `workspace.alvesz` — `privateWorkspace`, `allowedWorkspaceSlugs: ["alvesz"]`
- Skill `skill.alvesz-experience` — mesma restrição; visibilidade `WORKSPACE`
- `listPublicSkills` oculta privadas salvo `includePrivate` + slug permitido
- **Doc:** `docs/platform/private-workspace-skills.md`

---

## 16. Export/import

- **Arquivo:** `export-import.ts`
- Formato: `aura-platform-config/v1`
- `exportConfigurationPure`, `previewImportPure`, `importConfigurationPure` (exige `confirmed: true`)
- `sanitizeExportConfig` remove dados sensíveis
- `validateExportSchema` na importação

---

## 17. SaaS readiness

- **Arquivo:** `saas-readiness.ts` — `saasReadinessGaps()`
- Checklist auditável: tenant isolation, optional modules, config, onboarding, flags, logs, RLS, permissions
- Gaps declarados: billing, rate limiting HTTP, external costs por tenant, white-label completo, auto-migration prod
- **Doc:** `docs/platform/saas-readiness.md`

---

## 18. Metering

- **Arquivo:** `metering.ts`
- `recordUsageEventPure`, `aggregateUsage` (ex.: `provider_calls`, storage)
- Foundation para limites futuros; **sem bloqueio comercial em 10.0**

---

## 19. Entitlements

- **Arquivo:** `entitlements.ts`
- Catálogo de planos: `FREE`, `PRO`, `BUSINESS`, `CUSTOM` (`PLAN_CATALOG` com `futureLimits`)
- **`resolveEntitlementPure`:** em 10.0, **`fullAccess: true`** sempre; `features: ["*"]`
- **`commercialLimitWouldBlock`:** sempre `false` em 10.0
- **`assertEntitlementNotTampered`:** rejeita downgrade de plano/fullAccess via cliente

---

## 20. Admin

- **Arquivo:** `admin.ts`
- **`buildAdminSnapshot`:** capabilities, skills, flags, erros de instalação, migrations pendentes declaradas, usage agregado, health, versões
- Acesso: **`AURA_PLATFORM_ADMIN_USER_IDS`** (fallback `PLATFORM_ADMIN_USER_IDS`) — allowlist **somente servidor**
- **`canAccessAdminPlatform`** via `permissions.ts`
- **Rota:** `/dashboard/admin/platform` (`platform-admin-client.tsx`)
- `recordAdminActionPure` para audit de ações admin

---

## 21. Branding

- **Arquivo:** `branding.ts`
- `upsertWorkspaceBrandingPure`, `getWorkspaceBranding`, `primaryBrandLabel`
- Branding básico por workspace; white-label completo = gap (SaaS readiness)

---

## 22. Versionamento

- Semver em capabilities/skills (`compareSemver` no registry)
- `validateDeclaredVersion`, `resolveVersionState`, `deprecationWarning` (substituta via `replaces`)
- Admin snapshot: `platform: 10.0.0`, `configFormat: aura-platform-config/v1`
- Deprecated continua utilizável com aviso

---

## 23. Segurança

- Viewer não instala/muta capabilities
- Core não desinstala
- Consórcios rejeitado em register
- Skills/capabilities privadas filtradas por workspace slug
- Entitlements anti-tamper
- Feature flags não elevam permissão
- Migration com RLS nas tabelas `aura_*` (quando aplicada manualmente)
- Admin nunca confia em claim do cliente para allowlist
- Export sanitizado

---

## 24. Migration

- **Arquivo:** `supabase/migrations/20260731320000_sprint10_0_saas_skills_platform.sql`
- Tabelas: `aura_capabilities`, `aura_capability_installations`, `aura_capability_configs`, `aura_skills`, `aura_skill_installations`, feature flags, templates, branding, metering, entitlements, audit, onboarding, etc.
- **Código permanece source of truth** para definições; DB espelha instalações/estado
- ⚠️ **NÃO auto-aplicar em produção** — seguir `docs/deployment/migrations-checklist.md` / SQL manual quando aprovado

---

## 25. Testes

```bash
npm run test:platform
```

Arquivo: `utils/sprint10.0-platform.test.ts`

Cobertura inclui: registries, bootstrap core, install/enable skill, dependências, export/import, templates genéricos, metering/entitlements, admin allowlist, deprecation, Command Center intents, filtro de widgets Aura Home, smoke orchestrator.

Recomendado em CI junto com `typecheck` e suites existentes.

---

## 26. Performance

- Registries carregados uma vez (`capabilitiesReady` / `skillsReady`)
- Estado in-memory V1 — leituras O(n) sobre listas pequenas de instalações
- Resolver e navigation calculados sob demanda; sem round-trip DB na V1 UI
- Lazy: catálogo grande mas estático; impacto desprezível vs. orchestrator existente

---

## 27. Limitações

| Limitação | Detalhe |
|-----------|---------|
| Persistência | Estado de plataforma **in-memory**; reinício de sessão perde instalações locais até 10.1+ |
| Billing | Ausente por design |
| Marketplace | Ausente |
| Enforcement comercial | Limites declarados, nunca bloqueiam |
| Rate limit HTTP | Gap |
| White-label | Parcial |
| Hardcodes Anderson | **Gap parcial** em APIs/módulos legados, ex.: `utils/orchestrator.ts` (contexto Aura Central), `utils/coach.ts`, `app/api/aura-mentor/route.ts`, `app/api/whatsapp-ia/route.ts`, `components/dashboard/aura-chat.tsx`, `utils/notifications.ts`, `utils/executive.ts`, prompts em serviços de reports/legado — Identity cobre caminho novo; legado ainda usa fallback `"Anderson"` |
| DB sync | Migration não aplicada = sem backup multi-device de instalações |

---

## 28. Pendências

1. Persistir `PlatformState` via Supabase + actions server (10.1)
2. Remover/substituir hardcodes de display name e prompts legados por Identity/orchestrator context
3. Aplicar migration em staging e validar RLS end-to-end
4. Rate limiting e orçamento por tenant para provider calls
5. Enforcement opcional de `PLAN_CATALOG.futureLimits`
6. White-label e domínios customizados
7. Marketplace / skills de terceiros (`FUTURE_PUBLIC`)
8. Documentar migration 10.0 em `docs/deployment/sql-manual/` quando for para prod

---

## 29. Prontidão para Sprint 10.1

| Pré-requisito | Status |
|---------------|--------|
| API estável `lib/capabilities/index.ts` | ✅ |
| Skills V1 catalogadas e testadas | ✅ |
| Fluxos install/enable/export puros | ✅ |
| UI Skill Center + settings capabilities | ✅ |
| Onboarding route | ✅ |
| Admin snapshot + env allowlist | ✅ |
| Entitlements/metering hooks | ✅ (sem billing) |
| Migration SQL pronta | ✅ (apply manual) |
| Gaps SaaS documentados | ✅ |
| Cognitive kernel intocado | ✅ |

**Sprint 10.1 sugerida:** persistência server-side do estado de plataforma, sincronização com tabelas `aura_*`, hidratação do client a partir do usuário/workspace autenticado, e início de limites soft (avisos) antes de billing.

---

## Rotas entregues

| Rota | Função |
|------|--------|
| `/dashboard/skills` | Skill Center |
| `/dashboard/settings/capabilities` | Gestão de capabilities |
| `/dashboard/admin/platform` | Admin (allowlist) |
| `/dashboard/onboarding` | Onboarding pessoal/workspace |

---

## Documentação

- `docs/platform/capabilities.md`
- `docs/platform/skills.md`
- `docs/platform/feature-flags.md`
- `docs/platform/templates.md`
- `docs/platform/private-workspace-skills.md`
- `docs/platform/saas-readiness.md`

---

## Módulos `lib/capabilities/` (inventário)

`types.ts` · `catalog.ts` · `skills-catalog.ts` · `registry.ts` · `store.ts` · `resolver.ts` · `permissions.ts` · `dependencies.ts` · `lifecycle.ts` · `installation.ts` · `configuration.ts` · `validation.ts` · `feature-flags.ts` · `entitlements.ts` · `metering.ts` · `branding.ts` · `templates.ts` · `onboarding.ts` · `experience-modes.ts` · `navigation.ts` · `export-import.ts` · `admin.ts` · `command-center.ts` · `home-widgets.ts` · `saas-readiness.ts` · `index.ts`

---

**Assinatura de entrega:** Fundação SaaS & Skills **Definition of Done ✅** — UI V1 client in-memory aceita; produção multi-tenant completa depende de 10.1 + migration controlada.
