# Sprint 6.3 — Memory Engine V1

## 1. Resumo executivo

Memory Engine funcional com Experience Layer, quatro tipos de memória (EPISODIC / SEMANTIC / PROCEDURAL / REFLECTIVE), dedupe/idempotência, conflitos/correções, feedback, retenção determinística, **Memory Promotion Engine** gated para Identity, UI **“Memórias do Aura”**, auditoria, RLS migration e integração **read-only** ao Aura Brain Core (`executionInfluence: "none"`).

Nenhum dado de usuário específico está hardcoded. Pesquisa isolada não vira identidade/objetivo. Knowledge Graph **não** foi implementado.

## 2. Atualização arquitetural registrada

Documento: `docs/adr/ADR-003-addendum-sprint-6.3-architecture.md`

```
Experience Layer → Memory Engine → Memory Promotion Engine → Identity (+ futuro Graph)
```

Regras: Memory é histórico; Identity é autoridade sobre claims humanas; Memory nunca sobrescreve confirmada/corrigida/rejeitada/arquivada; promoção só via gates; pesquisa isolada nunca vira identidade.

## 3. Arquitetura implementada

```
UI /dashboard/settings/memory
  → app/actions/memory.ts
  → memory-engine.service.ts
  → lib/memory (puro)
  → store + Supabase best-effort
  → Promotion → Identity public contracts
  → runAuraBrain({ memory })  // context only
```

## 4. Arquivos criados e alterados

**Novos**

- `lib/memory/*` (types, experience, confidence, privacy, retention, promotion, engine, bootstrap, store, index)
- `lib/supabase/services/memory-engine.service.ts`
- `app/actions/memory.ts`
- `app/dashboard/settings/memory/page.tsx`
- `components/dashboard/memory/*`
- `supabase/migrations/20260728210000_memory_engine_v1.sql`
- `utils/memory-engine.test.ts`
- `docs/architecture/memory-engine.md`
- `docs/rfc/RFC-003-memory-engine-implementation.md`
- `docs/adr/ADR-003-addendum-sprint-6.3-architecture.md`
- `reports/sprint-6.3-memory-engine.md`

**Alterados**

- `lib/identity/types.ts`, `confidence.ts` (`memory_engine` source)
- `lib/aura-brain/core.ts`, `types.ts`
- `lib/supabase/services/aura-brain-core.service.ts`, `index.ts`
- `app/dashboard/settings/aura-brain/page.tsx`
- `package.json`
- `docs/adr/README.md`

## 5. Migrations

`supabase/migrations/20260728210000_memory_engine_v1.sql`

- `aura_experiences` (+ idempotency unique)
- `aura_memories` (+ índices user/type/status/occurred/context/source/weight/confidence/promotion/fingerprint/semantic)
- `aura_memory_evidence`
- `aura_memory_feedback`
- `aura_memory_promotions`
- `aura_memory_audit` (append-only)

Aplicar no Supabase antes de depender da persistência remota.

## 6. Contratos públicos

`recordExperience` · `createMemory` · `getMemory` · `listMemories` · `searchMemories` · `getContextualMemories` · `getMemoriesBySubject` · `getMemoryTimeline` · `explainMemory` · `correctMemory` · `disputeMemory` · `archiveMemory` · `deleteMemory` · `submitMemoryFeedback` · `evaluateMemoryPromotion` · `promoteMemory` · `getMemoryContextForBrain` · `bootstrapMemoryFromConfirmedData`

## 7. Tipos de memória

| Tipo | Conteúdo estruturado |
|------|----------------------|
| EPISODIC | when, where, participants, correlation |
| SEMANTIC | factKey, factValue, evidences |
| PROCEDURAL | steps, version, preconditions, validationStatus |
| REFLECTIVE | baseMemoryIds, derivationMethod, timeWindow |

## 8. Fluxo Experience → Memory

```
recordExperience
  → validate + normalize (Experience Layer)
  → idempotency / fingerprint
  → (opcional) createMemory tipada
  → audit experience_recorded
```

## 9. Fluxo de promoção para Identity

```
evaluateMemoryForPromotion (12 gates)
  → NO_PROMOTION | PROPOSE | ATTACH | QUEUE | FUTURE_GRAPH
promoteMemory
  → createIdentityClaim / observeIdentityEvidence (sourceType: memory_engine)
  → nunca confirma hipótese silenciosamente
  → nunca reativa REJECTED
```

## 10. Gates de confiança e privacidade

Ownership · Workspace · Privacy · Sensitivity · Source reliability · Confidence · Evidence count · Contradiction · User correction · Rejection history · Context · Idempotency

## 11. Dedupe e idempotência

`idempotencyKey` + `fingerprint` + janela temporal · `duplicateOfMemoryId` · merge de evidências **sem** inflar confidence

## 12. Retenção e esquecimento

Políticas iniciais + expiração determinística → OUTDATED  
Feedback `forget` → soft DELETE auditável  
Confirmados / `user_managed` / `permanent` não expiram silenciosamente

## 13. Medidas de segurança

- RLS `auth.uid() = user_id`
- Isolamento user/workspace no engine
- Bloqueio de inferência clínica/sensível
- Sem promoção de search/browse
- Audit payloads mínimos
- Ownership em mutações

## 14. Testes executados

| Suite | Resultado |
|-------|-----------|
| `test:memory` (38) | PASS |
| `test:identity` (20) | PASS |
| `test:security` (147) | PASS |
| typecheck | PASS |

## 15. Performance observada

- Registro/criação: <2ms em fixtures locais
- Consulta contextual / timeline / brain context: limites default (6–40)
- Cache curto ~5s com invalidação imediata em mutação
- Sem N+1 no caminho puro (arrays em memória + filtros)

## 16. Limitações conhecidas

- Persistência DB tipada ainda best-effort (tipos Database não regenerados)
- Embeddings não usados (busca textual/estrutural V1)
- Promotion para Identity em UI é “Avaliar Identity” (gated)
- Sem sync automático de todos os eventos de domínio ainda

## 17. Pendências

1. Aplicar migration no projeto Supabase  
2. Regenerar tipos Database  
3. E2E autenticado da UI memory  
4. Wire seletivo de eventos de domínio → `recordExperience` (sem promoção automática)

## 18. Recomendação Sprint 6.4

**Knowledge Graph V1** — projeção a partir de Mission Engine + memórias SEMANTIC promovidas (`FUTURE_GRAPH_CANDIDATE` / `EVIDENCED_BY`), sem Discovery completo.

## Definition of Done

- [x] Experience Layer  
- [x] Memory Engine + 4 tipos  
- [x] Origem, contexto, evidências  
- [x] Dedupe / idempotência  
- [x] Conflitos / correções  
- [x] Retenção básica  
- [x] Feedback  
- [x] Promotion Engine V1  
- [x] Integração gated Identity  
- [x] Pesquisa isolada ≠ identidade  
- [x] Correções/rejeições respeitadas  
- [x] UI Memórias do Aura  
- [x] RLS / isolamento  
- [x] Auditoria  
- [x] Brain read-only + executionInfluence none  
- [x] Testes  
- [x] Docs + relatório  
- [x] Sem Knowledge Graph completo  
- [x] Sem lógica específica de usuário  
