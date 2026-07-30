# RFC-003 — Memory Engine Implementation (Sprint 6.3)

| Campo | Valor |
|-------|-------|
| Status | Implemented (V1) |
| Data | 2026-07-28 |
| Base | ADR-001, ADR-003 (+ addendum), ADR-005, ADR-007, RFC-001, RFC-002 |
| Código | `lib/memory/*`, `lib/supabase/services/memory-engine.service.ts` |

---

## 1. Resumo

Implementa Memory Engine V1: Experience Layer, quatro tipos de memória, dedupe/idempotência, feedback, retenção determinística, Promotion Engine gated para Identity, UI “Memórias do Aura”, RLS e integração read-only ao Aura Brain Core.

## 2. Decisões de implementação

1. **Experience Layer** só valida/normaliza — não julga verdade.  
2. **structuredContent tipado** por memoryType (não blob genérico).  
3. **confidence ≠ importance ≠ weight**; **memory confidence ≠ promotion confidence ≠ identity confidence**.  
4. **Promotion Engine separado** com 12 gates.  
5. Integração Identity só via contratos públicos + `sourceType: "memory_engine"`.  
6. Persistência dual: store em processo + upsert best-effort (padrão 6.2).  
7. Sem Knowledge Graph tables.  
8. Sem hardcode de usuários/marcas/hobbies.

## 3. Pipeline atualizado

```
Experience → Memory → Promotion → Identity (gated)
                              ↘ FUTURE_GRAPH_CANDIDATE (fila conceitual)
Aura Brain Core ←── read-only memory context (executionInfluence: none)
```

## 4. Matriz de promoção (resumo)

| Origem | Decisão típica |
|--------|----------------|
| user_explicit / manual confirmado | PROPOSE_IDENTITY_CLAIM |
| Claim já confirmada | ATTACH_IDENTITY_EVIDENCE |
| Claim rejeitada | NO_PROMOTION |
| search_or_browse | NO_PROMOTION |
| REFLECTIVE não confirmada | QUEUE_FOR_REVIEW |
| RESTRICTED / sensível auto | NO_PROMOTION / BLOCKED |
| Semântico médio | FUTURE_GRAPH_CANDIDATE |

## 5. Retenção

`permanent` · `long_term` · `standard` · `short_term` · `session` · `until_date` · `user_managed`  
Confirmados não expiram silenciosamente. Expiração V1 é determinística.

## 6. Testes / DoD

Ver `reports/sprint-6.3-memory-engine.md`.

## 7. Próximo (fora deste RFC)

Sprint 6.4 sugerida: Knowledge Graph V1 (projeção a partir de missões + memórias promovidas).
