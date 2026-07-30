# Internal API v1 — Aura Brain Kernel (RC1)

Baseline de contratos após consolidação RC1.  
Nomes físicos podem diferir dos namespaces conceituais `identity.*` / `memory.*` / `worldModel.*` / `cognitive.*`.

## Classes

| Classe | Significado |
|--------|-------------|
| **STABLE** | Comprovado por implementação + testes; mudanças incompatíveis exigem depreciação |
| **INTERNAL** | Pure engines, stores, registries — não consumir da UI |
| **EXPERIMENTAL** | Pode mudar sem aviso longo |
| **LEGACY** | Compatibilidade; preferir facades novas |
| **DEPRECATED** | Remoção futura após período de transição |
| **CANDIDATE_FOR_REMOVAL** | Sem consumidores comprovados |

## STABLE

### identity
`getIdentityProfile` · `getIdentityClaims` · `createIdentityClaim` · `observeIdentityEvidence` · `confirm/reject/correct/archive/deleteIdentityClaim` · `explainIdentityClaim` · `getIdentityHintsForBrain` (`executionInfluence: "none"`) · `getIdentityAuditLog`

### memory
`recordExperience` · `createMemory` · `get/list/searchMemories` · `getContextualMemories` · `getMemoriesBySubject` · `getMemoryTimeline` · `explainMemory` · `correct/dispute/archive/deleteMemory` · `submitMemoryFeedback` · `evaluateMemoryPromotion` · `promoteMemory` · `getMemoryContextForBrain` · `bootstrapMemoryFromConfirmedData` · `getMemoryAuditLog`

### worldModel
`get/list/searchWorldEntities` · `listWorldRelationships` · `createWorldEntity/Relationship` · `getEntityNeighbors` · `getEntityRelationships` · `getRelationship` · `findPath` · `explainEntity/Relationship` · `getRelationshipTimeline` · `confirm/reject/correct` · `archive` · `mergeEntities` · `project*ToWorldModel` · `bootstrapWorldModel` · `getWorldContextForBrain` · `reconcileWorldEntity` · `getWorldAuditLog`

### cognitive
`buildCognitiveContextForUser` · `generateCognitiveArtifacts` · `list/get/searchCognitiveArtifacts` · `explainCognitiveArtifactService` · `submitCognitiveFeedback` · `confirm/reject/correct/archive/delete` · `suppressSimilarArtifacts` · `revalidateCognitiveArtifact` · `bootstrapCognitiveEngine` · `getCognitiveContextForBrain` · `getCognitiveAuditLog`

### brain
`runAuraBrain` · `getAuraBrainForDashboard` (slices identity/memory/world/cognitive/discovery com `executionInfluence: "none"`)

### shared
`lib/aura-kernel` — `SourceReference` · `EXECUTION_INFLUENCE_NONE` · `KernelErrorCode` / `normalizeKernelError`

## INTERNAL

`*Pure` em `lib/{identity,memory,world-model,cognitive,discovery}` · `get*State` / stores · registries · projectors puros · providers internos.

## LEGACY

`lib/aura-brain/memory/*` providers · serviços `ai_memories` legados · Intelligence rules (paralelo, não kernel 6.x).

## DEPRECATED / CANDIDATE_FOR_REMOVAL

Nenhum contrato STABLE removido na RC1.

## discovery.*

**EXPERIMENTAL (RC2):** `buildDiscoveryContextForUser` · `generateDiscoveries` · `list/get/searchDiscoveries` · `explainDiscoveryService` · `submitDiscoveryFeedback` · `confirm/reject/archive` · `suppressSimilarDiscoveries` · `bootstrapDiscoveryEngine` · `getDiscoveryContextForBrain` (`executionInfluence: "none"`) · `getDiscoveryAuditLog` · `getAuraBrainTimeline` · `searchAuraBrain`

UI diária: `/dashboard/discovery`

## Versionamento

1. **Compatível:** campos opcionais, novos contratos, ampliações de enum documentadas.  
2. **Incompatível:** remover/renomear campo obrigatório, mudar semântica de status/confidence.  
3. **Depreciação:** marcar DEPRECATED + adapter ≥ 1 sprint.  
4. **Testes de contrato** obrigatórios para STABLE.

## Convenções comuns (adocão gradual)

`userId` · `workspaceId` · `correlationId` · cursor pagination · `limit`/`maxLimit` · `timeRange` · `sensitivityScope` · `maxItems` · `dryRun` · `sourceReference` · `actor` · `reason` · `executionInfluence: "none"` em facades cognitivas.
