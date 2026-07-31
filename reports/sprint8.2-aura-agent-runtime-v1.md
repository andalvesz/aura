# Sprint 8.2 — Aura Agent Runtime V1

**Status:** ✅ Concluída  
**Data:** 2026-07-31  

---

## 1. Resumo executivo

Primeiro **agente operacional controlado** do Aura Brain: acompanha um objetivo, monta proposta de execução, usa só Action Registry e pede confirmação quando necessário. Sem autonomia irrestrita, shell, SQL, código arbitrário, pagamentos, publicação ou comunicação externa.

Fluxo: objetivo autorizado → contexto limitado → plano aprovado (quando exigido) → ações registradas → validação → preparação → confirmação/AUTO_SAFE → execução → verificação → auditoria → relatório.

---

## 2. Auditoria de agentes legados

| Componente existente | Reutilizado | Alterado | Legado | Motivo |
|----------------------|-------------|----------|--------|--------|
| `lib/agents/aura-brain-router.ts` | — | — | ✔ | Multiagente de **chat/síntese** — domínio distinto |
| `utils/agent-registry.ts` | — | — | ✔ | IDs de especialistas de conversa |
| `agent_history` | — | — | ✔ | Histórico de chat — mantido |
| `aura_command_history` | — | — | ✔ | Comandos Aura — mantido |
| Action Registry | ✔ | — | — | Única fonte de tools |
| Automation Engine 8.1 | ✔ | — | — | Padrão lease/confirm/gates |
| Planner V1 | ✔ | ✔ UI | — | Origem plan + “Executar com Agent” |
| Autonomy / settings | ✔ | ✔ | — | allowAutoSafe + per-agent |
| Mission Engine | ✔ RO | — | — | Não misturado ao runtime |
| Cron automations | ✔ | — | — | Sem novo cron de agentes V1 |

**Decisão:** novo `lib/agent-runtime/` (como Plan/Automation Centers). Não reutilizar o router de chat como runtime operacional.

---

## 3. Arquitetura

```
runAgentSession / createAgentSession
  → Agent Registry (5 agents)
  → Context Builder (RO, budgeted)
  → Policy Engine
  → Provider (deterministic / schema-gated)
  → Tool Boundary → Action Registry only
  → Confirm / AUTO_SAFE
  → Verify → Checkpoint → Report
```

---

## 4. Componentes reutilizados

Identity/Memory/World/Cognitive/Discovery/Decision/Scenario/Priority/Recommendation/Planner (contexto RO), Action Registry, Automation patterns (lease, hash, TTL), Audit, Autonomy Settings.

---

## 5. Agent Registry

Registro explícito em código. Bloqueia agente não registrado, versão incompatível, ação fora da allowlist, risco acima do teto, contexto/papel inválidos, plano não aprovado, orçamento/sessão expirada.

---

## 6. Agentes V1

1. **Daily Organizer** — Meu Dia, rascunhos, notificações  
2. **Plan Assistant** — plano aprovado obrigatório  
3. **Project Review** — riscos/revisão/notificação  
4. **Knowledge Organizer** — tags/organização, nunca apaga  
5. **Business Preparation** — rascunhos de negócio, sem empresa/pagar/publicar  

Padrão: **desabilitados** até enable explícito.

---

## 7. Tool boundary

Wrappers do Action Registry apenas. Sem Supabase client direto, fetch livre, shell, fs, env, service role, SQL, browser. Cliente não pode injetar tools.

---

## 8. Execution loop

Checkpoint → validar → contexto → passo → ação → policy → prepare → confirm/AUTO_SAFE → execute → verify → checkpoint → continuar/parar → relatório. Loop máximo pequeno; sem recursão aberta.

---

## 9. Policy Engine

Ownership, workspace, role, plan, registry, allowlist, autonomy, risk, confirmation, idempotency, quiet hours, lease, budgets, external/financial/delete/permission.

---

## 10. Context Builder

Contexto mínimo RO; filtra rejeitados/não confirmados/sensíveis/cross-user; budget por agente; sanitiza prompt injection.

---

## 11. Checkpoints

Após cada passo: completed/pending, executed actions + idempotency keys, artifacts, confirmation, context/plan version. Resume não reexecuta keys concluídas.

---

## 12. Verification

Não assume sucesso só por ausência de throw; exige sinal no output; modo strict para ações de plano.

---

## 13. Recovery

Timeout, lease, retryable/non-retryable, confirmation expired, context/plan changed, member removed, already executed, partial — sem restart silencioso.

---

## 14. Provider

Sugere só entre actionIds permitidos; schema validation; rejeita createTool/execute; fallback determinístico.

---

## 15. Human-in-the-loop

`WAITING_INPUT` / `WAITING_CONFIRMATION` com preview, risco, TTL; payload alterado invalida confirmação.

---

## 16. UI

- `/dashboard/agents` — Agent Center  
- `/dashboard/agents/[sessionId]` — detalhe  
- Planos: “Executar com Aura Agent”  
- Meu Dia: “Atividade dos agentes”

---

## 17. Settings

Por agente: enabled, max autonomy, limits, quiet hours, require confirmation; globais: pauseAll, allowAutoSafe. Default: disabled + SUGGEST/PREPARE.

---

## 18. Multiusuário

Owner da sessão; viewer não confirma; membership/workspace checks; sem dados privados de outro membro.

---

## 19. Segurança

Cobertura em testes: unregistered, tools, plan, AUTO_SAFE, viewer, injection, budgets, forbidden actions, lease.

---

## 20. Auditoria

Eventos `session_*`, `action_*`, `confirmation_*`, `verification_*`, `checkpoint_*`, `budget_*`, `policy_*`, `lease_*`, `provider_*`. Sem secrets/CoT.

---

## 21. Migration

`20260731290000_sprint8_2_agent_runtime_v1.sql` — sessions/steps/checkpoints/messages/confirmations/results/audit + RLS. **Não aplicar auto em produção.** Runtime V1 in-memory.

---

## 22. Testes

`npm run test:agents` → `utils/sprint8.2-agent-runtime.test.ts`

---

## 23. Performance

Budgets pequenos; contexto limitado; loop ≤ stepBudget.

---

## 24. Limitações

- Persistência preparada, runtime in-memory  
- Provider LLM live opcional (fallback determinístico)  
- Sem fan-out cron de agentes nesta sprint  

---

## 25. Pendências

Adapter Supabase; worker unattended; UI settings rica por agente no painel Brain.

---

## 26. Prontidão para Sprint 9.0

Base operacional controlada pronta. **Sprint 9.0 não iniciada.**

---

## Arquivos

- `lib/agent-runtime/**`  
- `app/actions/agent-runtime.ts`  
- `app/dashboard/agents/**`  
- `components/dashboard/agents/**`  
- `supabase/migrations/20260731290000_sprint8_2_agent_runtime_v1.sql`  
- `utils/sprint8.2-agent-runtime.test.ts`
