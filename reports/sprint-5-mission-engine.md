# Sprint 5 — Mission Engine V1

## Objetivo

Mudar o paradigma: o usuário organiza a vida por **missões**, e os módulos passam a servir cada missão.

API de consumo da aplicação: **`getMissionEngine()`**.

## Arquitetura

```
Create / load missions
  → Mission Planner (fases, marcos, tarefas, riscos, deps, recursos, módulos)
  → Mission Progress (breakdown, score, insights, missão do dia)
  → Suggested / safe automation proposals (LOW only)
  → Aura Brain Planner (integra missionActions)
  → Meu Dia + /dashboard/missions
```

```
lib/missions/
  mission-types.ts
  mission-templates.ts
  mission-rules.ts
  mission-planner.ts
  mission-progress.ts
  mission-engine.ts      # runMissionEngine (puro)
  mission-store.ts       # memória de processo
  index.ts

lib/supabase/services/mission.service.ts   # getMissionEngine()
app/actions/missions.ts
supabase/migrations/20260728190000_mission_engine_v1.sql
```

## Modelo

Mission · MissionGoal · MissionPhase · MissionMilestone · MissionTask ·  
MissionRisk · MissionMetric · MissionDependency · MissionResource · MissionRecommendation

**Tipos:** PERSONAL · BUSINESS · LEARNING · HEALTH · FINANCIAL · TRAVEL · CUSTOM  
**Estados:** PLANNING · ACTIVE · PAUSED · BLOCKED · COMPLETED · ARCHIVED

## Planejamento ao criar

O engine gera automaticamente: fases, marcos, tarefas, duração estimada, riscos, dependências, recursos e módulos envolvidos (calendário, financeiro, saúde, hábitos, objetivos, viagens, idiomas, expert_brain, business_lab, planner, automation).

Exemplo de dependência: Comprar passagem → Economizar dinheiro → Definir meta financeira.

## Automações / segurança

- Pode sugerir: tarefas, lembretes, eventos, recálculo de prioridades, bloqueios, ações.
- **Nunca** executa HIGH/CRITICAL automaticamente.
- BUSINESS gera hipóteses/experimentos/oportunidades em rascunho — **nunca cria empresa**.
- Actions novas: `create_mission_reminder`, `create_mission_task_draft`.
- Automation: `notify_mission_stalled` (notificação interna LOW).

## Progresso & Score

Breakdown por fase e por módulo (ex.: Financeiro 20%, Saúde 80%, Total 47%).  
Score: Prioridade · Risco · Confiança · Tempo restante · Saúde · Overall.

Insights: parada · evoluiu · corre risco · adiantada · bloqueada · concluída.

## UI

| Rota | Função |
|------|--------|
| `/missions` | Redirect → `/dashboard/missions` |
| `/dashboard/missions` | Dashboard: ativas, progresso, fases, marcos, riscos, tempo, ações |
| Meu Dia | Card **Missão do dia**: “Hoje você avançará X% na missão Y” |

Nav: módulo `missions` em **Vida** (OS_NAV).

## Integrações

| Sistema | Como |
|---------|------|
| Intelligence | Reusa score/priorities no `getMissionEngine({ intelligence })` |
| Planner | `missionActions` → planos `source: mission_engine` |
| Automation Engine | Propostas LOW + automation stalled |
| Meu Dia | `getMissionEngine` + card Missão do dia |

## Migrations

`supabase/migrations/20260728190000_mission_engine_v1.sql` — tabela `aura_missions` (RLS own-row) + payload JSONB.

Persistência: store em memória + best-effort upsert (padrão Aura Brain settings).

## Testes / DoD

| Check | Status |
|-------|--------|
| unit mission-engine (11) | PASS |
| test:security (89) | PASS |
| typecheck | PASS |
| build | PASS (`/dashboard/missions` + `/missions`) |
| audit:ui | PASS (dead=0) |
| Playwright smoke | 27 pass (incl. `/dashboard/missions`) |
| Playwright missions | 1 pass · 3 skip (creds E2E) |

Scripts: `npm run test:missions` · `test:security` · `test:intelligence` incluem mission tests.

## Pendências

1. Aplicar migration `20260728190000_mission_engine_v1.sql` no projeto Supabase  
2. Tipos gerados do DB ainda sem `aura_missions` (acesso loose/best-effort)  
3. `.env.e2e` local para E2E autenticado de criação de missão  
4. Sync bidirecional profundo com módulos (criar evento/gasto reais a partir de tarefas) — V2  
5. Expert Brain V2 — não iniciado  

## Definition of Done

- [x] Mission Engine funcional (puro + `getMissionEngine`)
- [x] Sem mocks de progresso/planejamento (templates + rules determinísticos)
- [x] Integrado ao Planner
- [x] Integrado ao Intelligence (reuse)
- [x] Integrado ao Meu Dia
- [x] Página `/missions` (+ `/dashboard/missions`)
- [x] Relatório final
- [x] Parar ao concluir Sprint 5
