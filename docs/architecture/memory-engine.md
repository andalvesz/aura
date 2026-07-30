# Memory Engine — Documentação técnica

**Sprint:** 6.3  
**ADRs:** 001, 003 (+ addendum), 005, 007 · **RFC:** 001, 003  
**Facade principal:** `recordExperience()` / `getMemoryContextForBrain()`

## O que é

O Memory Engine registra **experiências históricas** tipadas (episódica, semântica, procedural, reflexiva).  
Registrar ≠ acreditar. Lembrar ≠ identidade. Observar ≠ objetivo.

## Pipeline

```
Experience Layer
    ↓
Memory Engine
    ↓
Memory Promotion Engine
    ↓
Identity Engine (+ futuro Knowledge Graph)
```

## Princípios

1. Toda memória tem origem e contexto  
2. Feedback humano prevalece  
3. Correção explícita nunca é revertida silenciosamente  
4. Pesquisa isolada nunca vira identidade/objetivo  
5. Leituras não promovem nem executam  
6. `executionInfluence: "none"` no Brain  
7. Sem hardcode de usuários ou exemplos de vida no código  

## Pacote `lib/memory/`

| Arquivo | Função |
|---------|--------|
| `types.ts` | Experience, MemoryRecord, feedback, promotion |
| `experience.ts` | Experience Layer (normalize/validate) |
| `confidence.ts` | confidence / importance / weight |
| `privacy.ts` | ADR-007 |
| `retention.ts` | Políticas determinísticas |
| `promotion.ts` | Promotion Engine V1 |
| `engine.ts` | Operações puras |
| `bootstrap.ts` | Import seguro |
| `store.ts` | Estado + cache curto |
| `index.ts` | Surface pública |

## Contratos públicos

```
recordExperience()
createMemory()
getMemory()
listMemories()
searchMemories()
getContextualMemories()
getMemoriesBySubject()
getMemoryTimeline()
explainMemory()
correctMemory()
disputeMemory()
archiveMemory()
deleteMemory()
submitMemoryFeedback()
evaluateMemoryPromotion() / evaluateMemoryForPromotion()
promoteMemory()
getMemoryContextForBrain()
bootstrapMemoryFromConfirmedData()
```

## Tipos

| Tipo | Uso |
|------|-----|
| EPISODIC | Eventos no tempo |
| SEMANTIC | Fatos estáveis + evidências |
| PROCEDURAL | Processos com passos/versão |
| REFLECTIVE | Padrões derivados — revisão antes de Identity |

## Migrations

`supabase/migrations/20260728210000_memory_engine_v1.sql`

Tabelas: `aura_experiences`, `aura_memories`, `aura_memory_evidence`, `aura_memory_feedback`, `aura_memory_promotions`, `aura_memory_audit`  
RLS own-row em todas. Audit append-only.

## UI

Rota: `/dashboard/settings/memory` — **Memórias do Aura**

## Testes

```bash
npm run test:memory
npm run test:security
```

## O que esta sprint NÃO faz

Knowledge Graph · Discovery · Opportunity · Self Reflection automatizada · decay inteligente · embeddings obrigatórios · execução automática · missões a partir de memória
