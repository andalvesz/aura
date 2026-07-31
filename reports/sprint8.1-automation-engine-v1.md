# Sprint 8.1 — Automation Engine V1

**Status:** ✅ Concluída  
**Data:** 2026-07-31  
**executionInfluence (camadas anteriores):** `none`  
**executionInfluence (automações):** `proposed` | `prepared` | `confirmed` | `auto_safe` | `executed`

---

## 1. Resumo executivo

A Sprint 8.1 transforma etapas aprovadas de planos (e outras fontes confirmadas) em **automações controladas, limitadas, auditáveis e autorizadas**. Não há agentes autônomos, autonomia irrestrita, pagamentos, comunicação externa, exclusões ou mudanças de permissão.

Fluxo: Plano aprovado → etapa elegível → proposta → validação → aprovação/AUTO_SAFE → execução → resultado → auditoria → undo (quando suportado).

---

## 2. Auditoria da automação existente

| Componente existente | Reutilizado | Alterado | Motivo |
|----------------------|-------------|----------|--------|
| `lib/aura-brain/actions/registry.ts` | ✔ | ✔ | Único Action Registry — contratos V1 + novas ações |
| `lib/aura-brain/actions/executor.ts` | ✔ | — | Mantido para Brain Core / notify critical |
| `lib/aura-brain/actions/types.ts` | ✔ | ✔ | version, prepare, sanitize, schemas, flags |
| `lib/aura-brain/automations/engine.ts` | ✔ | — | Notify critical / mission stalled (domínio Brain) |
| `lib/aura-brain/automations/registry.ts` | ✔ | — | Flags de automações trigger-based |
| `lib/aura-brain/autonomy.ts` | ✔ | — | SUGGEST/PREPARE/CONFIRM/AUTO_SAFE + quiet hours |
| `lib/aura-brain/permissions.ts` | ✔ | — | Gates legados do executor |
| `lib/aura-brain/audit.ts` | ✔ | — | Auditoria Brain Core |
| `aura_brain_settings` | ✔ | ✔ (migration) | + `allow_auto_safe`, `pause_all_automations` |
| `aura_brain_automations` | ✔ | — | Flags por usuário (não é o Automation Center) |
| `aura_brain_audit_logs` | ✔ | — | Mantido; automação tem `aura_automation_audit` |
| `public.notifications` | ✔ | — | Notificações internas via action adapters |
| Planner V1 (`lib/planner`) | ✔ | ✔ UI | Fonte plan_step; botão “Preparar automação” |
| Plan Steps | ✔ | — | Elegibilidade APPROVED/IN_PROGRESS |
| Contratos públicos Brain | ✔ | ✔ settings | Defaults seguros |

**Decisão:** não criar segundo Action Registry. Automation Center vive em `lib/automation/` (como Plan Center em `lib/planner/`), reutilizando registry/autonomia/settings. O engine trigger-based do Brain Core permanece para notificações críticas — domínio distinto.

---

## 3. Componentes reutilizados

- Action Registry único  
- Autonomy levels + quiet hours  
- Aura Brain settings  
- Planner (origem)  
- Notificações internas (ações + store de automation notifications)  
- Padrão in-memory store (igual Sprint 7.x/8.0)

---

## 4. Arquitetura final

```
Fonte confirmada → proposeAutomation → Automation (PROPOSED, influence=proposed)
  → prepare → PREPARED | AWAITING_CONFIRMATION
  → confirm (token + payload hash + TTL) → APPROVED (confirmed)
  → execute (lease + row_version + gates) → SUCCEEDED | FAILED | BLOCKED
  → undo? → UNDONE
  → audit + internal notifications
```

Worker opcional: `GET /api/automations/process` com `CRON_SECRET` (lote pequeno, por userId).

---

## 5. Ações registradas (V1)

**AUTO_SAFE elegíveis (LOW):**  
`create_internal_notification`, `create_notification`, `create_personal_task_draft`, `create_calendar_event_draft`, `create_financial_entry_draft`, `create_content_idea_draft`, `create_business_idea_draft`, `complete_habit`, `update_goal_progress`, `retry_expert_brain_document`, `mark_plan_step_complete`, `create_plan_review_reminder`, `assign_internal_plan_owner`, `archive_internal_notification`, (+ mission/workout drafts).

**CONFIRM obrigatório:**  
`create_calendar_event`, `create_personal_task`, `create_financial_entry_final`, `modify_plan_deadline`, `update_project_status`.

**Bloqueadas (não registradas):** e-mail, WhatsApp, publish, payment, delete, permissions, shell, código arbitrário, pesquisa externa autônoma.

---

## 6. Matriz de risco

| Risco | AUTO_SAFE | CONFIRM | Manual |
|-------|-----------|---------|--------|
| LOW (eligible) | ✔ se settings | ✔ | ✔ |
| MEDIUM | ✖ | ✔ | ✔ |
| HIGH / CRITICAL | ✖ | ✔ | ✔ |
| Financial final | ✖ | ✔ | ✔ |
| External / delete / permission | ✖ | ✖ (bloqueado) | ✖ |

---

## 7. Matriz de autonomia

| Nível | Comportamento |
|-------|----------------|
| SUGGEST (padrão) | Apresenta proposta |
| PREPARE | Rascunho + payload, não executa |
| CONFIRM | Exige confirmação explícita (TTL) |
| AUTO_SAFE | Só LOW + allowAutoSafe + gates |

---

## 8. Plan → Automation

No detalhe da etapa (plano APPROVED/IN_PROGRESS): **Preparar automação**.  
Nunca executa ao abrir/ler o plano. Gera objeto separado.

---

## 9. Confirmation flow

prepare → preview sanitizado → origem/risco/undo → token → validação servidor (hash + expiry) → execute → audit.  
Confirmação antiga ou payload alterado → rejeitada.

---

## 10. AUTO_SAFE gates

LOW · registrada · allowAutoSafe · ação permitida · contexto · sem external/financial final/delete/permission · limite diário · quiet hours · cooldown · idempotency · origem confirmada · auditoria.  
Falha → `BLOCKED` ou `AWAITING_CONFIRMATION`. Sem fallback silencioso.

---

## 11. Scheduling

- Executar agora / datetime futuro / revisão diária manual  
- Endpoint `app/api/automations/process/route.ts` autenticado por `CRON_SECRET`  
- limit≤5, lease, por userId (sem fan-out multi-tenant V1)  
- **Limitação:** processamento unattended completo depende de cron + secret + user targeting; sem isso, execução manual permanece a via principal.

---

## 12. Lease e concorrência

`row_version`, `lease_owner`, `lease_expires_at`, `execution_attempt`, update condicional, `idempotencyKey` única, status `RUNNING` exclusivo. Lease expirado recuperável.

---

## 13. Retry

Classes: RETRYABLE, NON_RETRYABLE, AUTH_REQUIRED, VALIDATION, PERMISSION, RATE_LIMIT, TIMEOUT, CONFLICT, DEPENDENCY_BLOCKED.  
Backoff + max attempts + retry manual.

---

## 14. Undo

Suportado em notificação, drafts, hábito, assign interno, mark_plan_step_complete.  
Valida ownership, janela 24h, conflito `mutatedAfter`, audita, marca `UNDONE`.

---

## 15. UI

- `/dashboard/automations` — Automation Center (seções + filtros)  
- `/dashboard/automations/[id]` — detalhe + ações + explain + audit  
- Meu Dia — bloco “Automações do Aura Brain”  
- Planos — automações vinculadas + botão preparar  
- Settings Aura Brain — painel de automações

---

## 16. Settings

Nível padrão, allowed/blocked actions, limites, quiet hours, confirmações financial/external/destructive, allowAutoSafe, pauseAll, revoke pending confirmations. Defaults seguros.

---

## 17. Segurança

- userId/workspace resolvidos no servidor  
- Ownership + membership + roles (viewer não muta)  
- Payload/actionId adulterados rejeitados  
- Confirmação de outro ator / expirada / hash mismatch  
- Enumeração: get retorna not_found sem vazar  
- Sem ações externas/pagamento/delete/permission no registry

---

## 18. Auditoria

Eventos `automation_*`, `lease_*`, `limit_reached`, `cooldown_active`, `quiet_hours_blocked`.  
Sanitize: tokens/senhas/secrets redacted.

---

## 19. Migration

`supabase/migrations/20260731280000_sprint8_1_automation_engine_v1.sql`  
Tabelas: `aura_automations`, `_attempts`, `_confirmations`, `_schedules`, `_leases`, `_audit`.  
RLS + idempotency unique + índices + soft delete.  
**Não aplicar automaticamente em produção.**  
Runtime V1: in-memory (mesmo padrão Planner).

---

## 20. Testes

`npm run test:automation` → `utils/sprint8.1-automation.test.ts`  
Cobre registry, proposta, prepare/confirm/expiry/tamper, AUTO_SAFE, riscos, idempotência, lease, quiet hours, limite, cooldown, retry, undo, ownership, widget, explain, migration, bloqueios.

---

## 21. Performance

Operações O(n) em store in-memory; lote cron ≤5; índices SQL preparados para persistência futura.

---

## 22. Limitações

- Persistência DB preparada, runtime ainda in-memory  
- Cron multi-usuário não fan-out  
- Undo limitado às ações que declaram `undo`  
- Sem integração real calendário/financeiro final (só draft/confirm)

---

## 23. Pendências

- Adapter Supabase para `aura_automations*`  
- Worker multi-tenant autenticado  
- Persistência de settings allowAutoSafe no DB client

---

## 24. Prontidão para Sprint 8.2

Pronto para evoluir execução assistida / orquestração **sem** agentes autônomos.  
**Não iniciado Sprint 8.2.**

---

## Arquivos principais

- `lib/automation/**`  
- `lib/aura-brain/actions/{registry,types}.ts`  
- `app/actions/automation.ts`  
- `app/dashboard/automations/**`  
- `app/api/automations/process/route.ts`  
- `components/dashboard/automations/**`  
- `supabase/migrations/20260731280000_sprint8_1_automation_engine_v1.sql`  
- `utils/sprint8.1-automation.test.ts`
