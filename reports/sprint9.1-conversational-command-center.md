# Sprint 9.1 — Conversational Command Center

**Status:** ✅ Concluída  
**Data:** 2026-07-31  

---

## 1. Resumo executivo

O usuário passa a conversar com o Aura em linguagem natural em `/dashboard/brain`, com intenções estruturadas, contexto resolvido no servidor, respostas com fontes, rascunhos e propostas que **nunca** executam fora de Action Registry / Planner / Automation / Agent Runtime.

Não há novo Brain, Planner, Automation Engine ou Agent Runtime. O chat legado (Aura Central, Mentor, aura-commands, `ai_messages`) permanece; o Command Center é a superfície consolidada de conversa operacional segura.

---

## 2. Auditoria do chat legado

| Componente atual | Reutilizado | Evoluído | Legado | Motivo |
|------------------|-------------|----------|-------|--------|
| Aura Central (`/dashboard`) | ✔ | — | — | Widget de home; link para Brain |
| `POST /api/aura-central` | ✔ | — | — | Chat/coach/commands existentes |
| Aura Mentor | — | — | ✔ | Domínio crescimento; paralelo |
| `AuraChat` + `/api/aura` | — | — | ✔ | UI morta; isolado |
| `aura-brain-router` | ✔ RO | — | — | Multiagente de síntese; distinto do runtime |
| `agent_history` | ✔ | — | — | Log de chat agents |
| `ai_messages` | ✔ | — | — | Histórico LLM por módulo |
| `aura_command_history` | ✔ | — | — | Comandos Aura Central |
| Command Palette V2 | ✔ | ✔ | — | Intent NAVIGATE/SEARCH |
| Global Search V2 | ✔ | ✔ | — | Hits na conversa |
| Orchestrator 9.0 | ✔ | ✔ | — | Global context + session |
| Aura Brain Core / Action Registry | ✔ | — | — | Fronteira de execução |
| Agent Runtime 8.2 | ✔ | — | — | Sessões propostas, não iniciadas às cegas |
| Automation Engine 8.1 | ✔ | — | — | Propostas via gates |
| Planner 8.0 | ✔ | — | — | Drafts sem aprovar/iniciar |
| Streaming HTTP | — | ✔ simulado UI | — | Sem SSE server ainda |
| `lib/conversation` | — | ✔ novo | — | Command Center |

---

## 3. Arquitetura

```
UI /dashboard/brain
  → app/actions/conversation.ts
    → conversation.service (viewer server-side)
      → handleAuraConversationPure
           → policy / injection
           → provider schema (deterministic) + intent router (rules win)
           → context resolver (Orchestrator Global Context + search hits)
           → response composer + citations
           → drafts / pending actions (hash + TTL)
           → confirm → marca CONFIRMED; engines existentes permanecem autoridade
```

---

## 4. Componentes reutilizados

Orchestrator, Search V2, Command Palette, Action Registry, Planner, Automation, Agent Runtime, Smart Capture/Knowledge (anexos via links), Identity/Memory/World apenas como fontes RO via contexto global.

---

## 5. Intent Model

`NAVIGATE | SEARCH | SUMMARIZE | EXPLAIN | COMPARE | REVIEW | ASK_STATUS | CREATE_DRAFT | PROPOSE_PLAN | PROPOSE_AUTOMATION | START_AGENT_SESSION | CONFIRM_ACTION | CANCEL_ACTION | PROVIDE_INPUT | UPDATE_CONTEXT | UNKNOWN`

Campos: confidence, entities, targets, actionability, requiresConfirmation, allowedHandlers, ambiguity, missingInformation. LLM nunca prevalece sobre regras.

---

## 6–8. Context, fontes, explainability

Resolver budgetado; isolamento de dados privados de outros membros; citações clicáveis; “Não encontrei dados suficientes”; explicação sem CoT (evidências, regras, confiança, limitações, executou ou não).

---

## 9–11. Navegação, busca, resumos

Rotas via `ROUTE_REGISTRY` + Palette. Search via Global Search V2. Resumos com fontes e limitações; conteúdo externo wrapped como UNTRUSTED.

---

## 12–15. Drafts / Plan / Automation / Agent

Todos geram preview + `ConversationPendingAction` com `payloadHash`. Confirmação explícita por card (ID+hash). Texto “sim” não executa. Engines existentes não são contornados.

---

## 16–18. Confirmação, conversation memory, attachments

TTL 15min; payload alterado → rejeita; expirado → rejeita. Memory choice default `none` — sem promoção automática. Anexos via Inbox/Knowledge.

---

## 19–22. Multiusuário, provider, injection, policy

RLS na migration; viewers não propõem ações; provider sem tools/DB/execute; injection patterns bloqueados; rate limit / tamanho / ownership.

---

## 23–24. Migration e API

`20260731300000_sprint9_1_conversational_command_center.sql` — tabelas + RLS (não aplicar auto em produção). Actions: start/send/list/get/updateContext/confirm/cancel/archive/delete/export/explain/home widget.

---

## 25. Home

Aura Home: “Perguntar ao Aura”, conversas recentes, confirmações, drafts.

---

## 26. Testes

`npm run test:conversation` — auditoria, intents, contexto, fontes, summarize/search/navigate, drafts, confirmação, memory, injection, multiuser, provider, history, regressões.

---

## 27. Limitações / pendências

- Persistência ainda in-memory no runtime (migration preparada).
- Streaming é simulado no cliente (sem SSE).
- Bridge pós-confirmação para generatePlan/proposeAutomation/createSession é deliberadamente conservador (abre caminho sem auto-executar).
- Aura Central legado não foi removido.

## 28. Prontidão para Sprint 9.2

Base conversacional segura pronta para evolução (streaming real, adapter Supabase, deep-links de confirmação operacional). **Não iniciar 9.2 nesta entrega.**
