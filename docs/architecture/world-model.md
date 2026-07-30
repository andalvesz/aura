# World Model — Documentação técnica

**Sprint:** 6.4  
**ADRs:** 001, 004 (+ addendum), 005, 007 · **RFC:** 001, 004  
**Facade:** `getWorldContextForBrain()` / `bootstrapWorldModel()`

## O que é

O **World Model** é a projeção cognitiva de entidades e relações sobre Memory, Identity e domínios operacionais.  
**Knowledge Graph** = nome técnico da infraestrutura.  
Tabelas de domínio continuam sendo a autoridade operacional.

## Pipeline

```
Experience → Memory → Promotion → World Model → Cognitive Engine → Discovery → Mission/Planner → Execution
```

`executionInfluence: "none"` nesta sprint (World Model). Cognitive Engine (6.5) consome o World Model em modo somente leitura.

## Pacote `lib/world-model/`

| Arquivo | Função |
|---------|--------|
| `types.ts` | WorldEntity, WorldRelationship |
| `entity-registry.ts` | Tipos de entidade versionados |
| `relationship-registry.ts` | Tipos de relação + validação |
| `confidence.ts` | Scores por estágio |
| `privacy.ts` | ADR-007 |
| `resolution.ts` | Entity resolution determinística |
| `engine.ts` | Operações puras |
| `projectors/*` | Memory, Identity, Mission, Business, Document |
| `bootstrap.ts` | Import seguro |
| `store.ts` | Estado + cache |

## Contratos públicos

`getWorldEntity` · `listWorldEntities` · `searchWorldEntities` · `getEntityNeighbors` · `getEntityRelationships` · `getRelationship` · `getRelationshipTimeline` · `findPath` · `explainEntity` · `explainRelationship` · `createWorldEntity` · `createWorldRelationship` · `confirm/reject/correct/archive` · `mergeEntities` · `projectMemory/Identity/MissionToWorldModel` · `bootstrapWorldModel` · `getWorldContextForBrain` · `reconcileWorldEntity`

## Migrations

`supabase/migrations/20260728220000_world_model_v1.sql`

## UI

`/dashboard/settings/world-model` — **Mapa do Aura**

## Testes

```bash
npm run test:world
npm run test:security
```

## Não faz

Discovery · Neo4j · embeddings · multi-hop complexo · execução por grafo · criação automática de missões
