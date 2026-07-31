# Sprint 9.2 — Continuous Learning Engine

**Status:** ✅ Concluída  
**Data:** 2026-07-31  

---

## 1. Resumo executivo

O Aura Brain observa confirmações, rejeições e resultados e gera **propostas de aprendizado revisáveis**. Modo automático = **AUTO_OBSERVE** apenas (sinais → padrões → propostas). Nenhuma aplicação silenciosa, sem fine-tuning, sem elevação de autonomia ou ampliação de allowlist.

---

## 2. Auditoria de feedback existente

| Fonte de feedback | Reutilizada | Adaptada | Limitação |
|-------------------|-------------|----------|-----------|
| `lib/aura-brain/learning/feedback` + `aura_brain_feedback` | ✔ | Adapter `aura-brain` | Store in-memory + SQL legado |
| Recommendation feedback | ✔ | Adapter `recommendation` | Não reescreve engine |
| Planner feedback | ✔ | Adapter `planner` | Só sinais; não altera planos |
| Automation results | ✔ | Adapter `automation` | Sugere limites, não remove confirm |
| Agent Runtime outcomes | ✔ | Adapter `agent-runtime` | Nunca amplia allowlist |
| Conversation ratings | ✔ | Adapter `conversation` | Preferência via Orchestrator personality |
| Discovery / Identity / Memory / Decision / Scenario / Priority / Cognitive | ✔ | Adapters registrados | Correções humanas prevalecem |
| World / Projects / Knowledge / Daily | ✔ | Adapters leves | Observação apenas |

---

## 3. Arquitetura

```
Eventos / feedbacks
  → ingestLearningSignal (registry + idempotency)
  → runLearningCycle (AUTO_OBSERVE)
       → aggregate patterns
       → generate PENDING_REVIEW proposals
  → Human Review (confirm / reject + hash)
  → apply (safe V1 only) → evaluation → revert
```

`lib/learning/` — types, store, registry, signal-normalizer, pattern-aggregator, proposal-generator, policy, evaluation, engine, providers/schema, services.

---

## 4–8. Signals, registry, aggregation, proposals

Sinais tipados com idempotencyKey. Registry bloqueia adapter/evento não registrado. Padrões exigem amostra mínima (3). Propostas nascem `GENERATED` → `PENDING_REVIEW`, nunca `APPLIED`.

---

## 9–12. Status, escopo, human review, aplicações V1

Escopo padrão PERSONAL. Workspace exige owner/admin. Confirmação = proposalId + payload hash. Aplicações: preferência de comunicação (Orchestrator), filtros/suppressions/limites sugeridos — sem financeiro, publish, autonomia↑, allowlist↑.

---

## 13–18. AUTO_OBSERVE, UI, explain, evaluation, reversion

`/dashboard/learning` + `/dashboard/learning/[id]`. Explicabilidade sem CoT. Avaliação correlacional. Reversão com snapshot e conflito se houver mudança mais nova.

---

## 19–24. Identity / Memory / Planner / Automation / Agents / Conversation

Learning **propõe**; não confirma claims, não cria Memory sem fluxo futuro confirmado, não altera Planner automaticamente, não remove confirmação de automação, não habilita agentes, preferências de conversa via personalidade do Orchestrator.

---

## 25–30. Multiusuário, suppression, cache, provider, segurança, auditoria

Isolamento por userId; private cross-user bloqueado; suppression após rejeição; cache Orchestrator invalidado; provider só redige (schema); auditoria sanitizada.

---

## 31. Migration

`20260731310000_sprint9_2_continuous_learning.sql` — tabelas + RLS. Não aplicar auto em produção. Runtime V1 in-memory.

---

## 32–33. Home + Conversation + notificações internas

Aura Home: widget de propostas/avaliações. Command Center responde perguntas sobre aprendizado e aponta para cards explícitos.

---

## 34. Testes

`npm run test:learning` — registry, dedupe, padrões, propostas, confirm/reject/apply/eval/revert, security, provider, home, regressões.

---

## 35. Limitações / pendências / Sprint 10.0

- Persistência adapter Supabase ainda pendente.
- Memory reflexiva / Identity evidence são contratos preparados, aplicação completa fica para evolução.
- Sem causalidade absoluta nas avaliações.

**Não iniciar Sprint 10.0 nesta entrega.**
