# RFC-004 — World Model Foundation (Sprint 6.4)

| Campo | Valor |
|-------|-------|
| Status | Implemented (V1) |
| Data | 2026-07-28 |
| Base | ADR-001, ADR-004 (+ addendum), ADR-005, ADR-007, RFC-001–003 |
| Código | `lib/world-model/*`, `lib/supabase/services/world-model.service.ts` |

---

## 1. Resumo

Implementa o World Model V1: entidades/relações tipadas, registries, entity resolution determinística, projectors (Memory/Identity/Mission/Business/Document), consultas de vizinhança e path curto (profundidade ≤2), suppression, bootstrap, UI “Mapa do Aura”, RLS e integração read-only ao Brain.

## 2. Decisões

1. World Model = produto; Knowledge Graph = infraestrutura.  
2. Domínio permanece autoridade operacional.  
3. Projeções idempotentes por `sourceReference` / `canonicalKey`.  
4. Merge nunca por nome sozinho.  
5. FOUNDER_OF exige declaração explícita.  
6. Pesquisa isolada não cria INTERESTED_IN / HAS_GOAL / HAS_MISSION.  
7. PostgreSQL suficiente (sem Neo4j).  
8. Sem hardcode de usuários/exemplos.

## 3. Matriz de autoridade

| Fonte | Edita | World Model |
|-------|-------|-------------|
| Mission Engine | missão | projeta |
| Identity | claims | projeta CONFIRMED/LEARNED |
| Memory | memórias | projeta elegíveis |
| Business/Workspace | cadastro | projeta |
| World UI | correção cognitiva | não altera fonte silenciosamente |

## 4. Próximo

Sprint 6.5 sugerida: Discovery Engine V1 (candidatos tipados consumindo World Model + Memory + Identity).
