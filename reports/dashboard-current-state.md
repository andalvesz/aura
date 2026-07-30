# Dashboard — estado atual (pré Sprint 1)

Data: 2026-07-28

## Rota

- `app/dashboard/page.tsx` → composição cliente estática (sem branch de contexto)
- Layout: `app/dashboard/layout.tsx` + `DashboardShell` + `ContextSwitcher`

## Elementos existentes (home)

| Bloco | Componente | Origem dos dados |
|-------|------------|------------------|
| XP | `AuraXpPanel` | `GET /api/xp` → `user_xp` (PERSONAL) |
| Operação do dia | `DailyOperationsPanel` | hooks client: eventos, growth_leads, orçamentos, gastos, financial_*, goals, health_* |
| Visão executiva | `ExecutiveDashboardView` | mesmos hooks + KPIs util `executive.ts` |
| Memórias | `RecentMemoriesCard` | `/api/memory/recent` |
| Metas | `GoalsDashboardCard` | `goals` |
| Revenue | `RevenueDashboardCard` | `/api/revenue` (integrações) |
| Comms | `CommsDashboardCard` | `/api/comms/stats` |
| Relatórios | `ExecutiveReportsPanel` | `/api/executive-reports` |
| Aura Central | `AuraCentral` | `POST /api/aura-central` |

**Gráficos na home:** nenhum.

## Problemas

1. Home **não troca blocos** por `activeContext` — workspace só “esvazia” hooks.
2. **Duplicação** Daily Ops × Executive (duas saudações, queries duplicadas).
3. KPI “Receita” mistura growth + Alvesz e **ignora** `financial_income` / saldo real.
4. ~15+ queries client em paralelo; falha parcial vira lista vazia sem erro claro.
5. `ModuleOverviewGrid` morto + placeholders `"0"` / `"—"` em `lib/modules.ts`.
6. Ação “Novo cliente” no personal falha sem workspace.
7. Greeting default `"Anderson"` em `getExecutiveGreeting` se nome ausente.
8. Expert Brain / membros / estoque **não** estão na home.

## Reutilizáveis

- `Panel`, `MetricCard`, `EmptyState`, `ActionButton`, skeletons
- `loadSmartFinanceDashboard`, `listUpcomingEventos`, `listGoals`
- `getExpertBrainDashboard`, Alvesz services, `listWorkspaceMembers/Invites`
- `ContextSwitcher` + soft-heal em `getDataContext`
- Modais `add-*-modal.tsx`

## Remover / tirar da home

- Composição Daily Ops + Executive + cards sobrepostos na home
- `ModuleOverviewGrid` (não montar; métricas fake)
- Não apagar módulos/páginas existentes

## Riscos de vazamento

| Risco | Mitigação atual / gap |
|-------|------------------------|
| Workspace sem membership | Soft-heal no server (`context.ts`) |
| Hooks client com workspace_id | `shouldLoadWorkspaceTable` — OK se UI respeitar |
| Mistura personal×workspace na mesma tela | **Gap** — Sprint 1 deve isolar blocos |
| Confiar só em profile client | Server deve revalidar (já faz em services) |

## Decisão Sprint 1

Mesma rota `/dashboard`: server escolhe `PersonalDashboard` ou `WorkspaceDashboard` via `getDataContext()`. Dados agregados no servidor; atalhos com links/modais reais; sem números mockados.
