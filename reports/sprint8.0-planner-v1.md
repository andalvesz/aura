# Sprint 8.0 — Planner V1

**Status:** ✅ Concluída  
**Data:** 2026-07-31  
**executionInfluence:** `none` (em todos os artefatos)

---

## 1. Resumo executivo

O Planner V1 transforma recomendações (e outras fontes) em **planos estruturados, revisáveis e aprováveis** pelo usuário. Responde:

> “Como posso transformar esta recomendação em um plano?”

Nunca executa ações, não cria tarefas/eventos/automações automaticamente e não altera o Kernel Cognitivo.

---

## 2. Auditoria do Planner existente

| Artefato | Papel | Decisão Sprint 8.0 |
|----------|-------|---------------------|
| `lib/aura-brain/planner/*` | Seletor de **ações propostas** do Brain Core (Sprint 4) | **Mantido intacto** — domínio diferente |
| `public.aura_brain_plans` | Planos curtos com `steps` jsonb + actionIds | **Não reutilizado** como Plan Center (modelo incompatível) |
| `lib/missions/mission-planner.ts` | Planejamento de missões | **Mantido** — consumido só em leitura |
| `money_mission_plans` / `creator_launch_plans` / `execution_plans` | Domínios específicos | **Não misturados** |

**Consolidação:** um único Plan Center em `lib/planner/` + tabelas `aura_plans*`. Sem segundo Planner paralelo de UI. O planner do Brain Core continua como camada de propostas de ação.

---

## 3. Arquitetura final

```
Fonte (RO) → buildPlanContext → seedDraft → runPlannerRegistry (7 engines)
  → materialize DRAFT → validate → dependency issues
  → revisão humana → PENDING_REVIEW → APPROVED
  → start (status only) → complete steps (manual) → COMPLETED
```

Nunca: execução externa, calendário, tarefas operacionais auto-criadas.

---

## 4. Arquivos

- `lib/planner/**` (types, context, engines, registry, validators, templates, dependencies, scheduling, services)
- `app/dashboard/plans/**`
- `components/dashboard/plans/**`
- `app/actions/planner.ts`
- `lib/supabase/services/planner.service.ts`
- `supabase/migrations/20260731270000_sprint8_0_planner_v1.sql`
- `utils/sprint8.0-planner.test.ts`

---

## 5. Migration

`20260731270000_sprint8_0_planner_v1.sql` — **não aplicar automaticamente em produção**.

Tabelas: `aura_plans`, `aura_plan_steps`, `aura_plan_dependencies`, `aura_plan_milestones`, `aura_plan_resources`, `aura_plan_risks`, `aura_plan_feedback`, `aura_plan_comments`, `aura_plan_audit`.

RLS + CHECK `execution_influence = 'none'` + soft_delete + row_version + índices.

Runtime V1: **in-memory** (mesmo padrão Sprint 7.x).

---

## 6. Contratos

`Plan`, `PlanStep`, `PlanMilestone`, `PlanResource`, `PlanRisk`, `PlanDependencyIssue`, feedback, comments, collaborators, notifications internas.

Sempre: `executionInfluence: "none"`.

---

## 7. Engines (Registry)

1. Goal Breakdown  
2. Step Sequencing  
3. Dependency  
4. Resource Planning  
5. Risk Planning  
6. Milestone  
7. Review Cadence  

---

## 8. Geração de planos

Fontes: recommendation · decision · scenario · priority · project · mission · manual.

Fluxo obrigatório: proposta → validação → **DRAFT** → revisão humana → aprovação.

---

## 9. Approval flow

`DRAFT → PENDING_REVIEW → APPROVED → IN_PROGRESS → (PAUSED|BLOCKED) → COMPLETED | CANCELLED | ARCHIVED`

Aprovar **não executa**. Iniciar só muda status.

---

## 10–13. Dependências / Milestones / Recursos / Riscos

Ciclos detectados e **exibidos** (nunca auto-corrigidos). Marcos só sugeridos (sem calendário). Recursos com disponibilidade. Riscos com probabilidade estimada ≠ certeza.

---

## 14. Colaboração

Roles: owner / editor / viewer. Comentários + menções. Transferência de owner restrita ao owner.

---

## 15. Explainability

Botão: “Como o Aura estruturou este plano?” — fontes, pipeline, premissas, limitações, pontos de decisão humana. Sem chain-of-thought.

---

## 16. Segurança

Isolamento user/workspace; viewer não edita; `executionInfluence` literal + validator + SQL CHECK; sem ações externas.

---

## 17. Testes

`npm run test:planner` — cobertura: registry, geração (rec/manual), ciclos, approval, validator, feedback, comments, collab, isolamento, busca, home, explain, UI routes, `executionInfluence = none`.

---

## 18. Performance

Cache in-memory por user/workspace; paginação no Plan Center; lazy import de fontes no service.

---

## 19. Limitações

- Persistência DB preparada, runtime ainda memória  
- Drag-and-drop completo: reordenação via ação “Inverter ordem” / reorder API (kanban visual por status)  
- Notificações apenas internas (sem e-mail/push/WhatsApp)

---

## 20. Pendências

1. Aplicar migration no Supabase quando for o caso  
2. Persistência tipada completa  
3. DnD fino no kanban (status change por drop)

---

## 21. Prontidão para Sprint 8.1

Base de Plan Center, approval e engines V1 está pronta. **Sprint 8.1 não iniciada.**

---

## Definition of Done

✔ Planner existente auditado e Brain planner preservado  
✔ Plan Center funcional  
✔ Geração por recomendação e manual  
✔ Etapas, dependências, ciclos  
✔ Milestones, recursos, riscos  
✔ Approval flow  
✔ Colaboração / busca / home / explainability  
✔ Testes / typecheck / build  
✔ `executionInfluence` = `"none"`  
✔ Sem tarefas/eventos/ações externas automáticas  
