# Sprint 6.4 — World Model Foundation

## 1. Resumo executivo

World Model V1 funcional: entidades e relações universais, registries, resolução determinística, projectors de Memory/Identity/Mission/Business/Document, vizinhança + path curto, suppression, bootstrap, UI **Mapa do Aura**, RLS e Brain read-only (`executionInfluence: "none"`).

Sem Discovery, Neo4j, embeddings ou lógica específica de usuário.

## 2. Adendo arquitetural

`docs/adr/ADR-004-addendum-world-model.md` — 10 regras + pipeline oficial.

## 3. Arquitetura

```
UI /dashboard/settings/world-model
  → app/actions/world-model.ts
  → world-model.service.ts
  → lib/world-model (puro + projectors)
  → store + Supabase best-effort
  → runAuraBrain({ world })  // context only
```

## 4. Arquivos criados / alterados

**Novos:** `lib/world-model/*`, projectors, service, actions, UI, migration, testes, RFC-004, docs, relatório, ADR-004 addendum  

**Alterados:** Brain core/types, aura-brain-core.service, settings link, package.json, docs/adr/README.md

## 5. Migrations

`supabase/migrations/20260728220000_world_model_v1.sql`  
Tabelas: entities, relationships, suppressions, audit + RLS + índices

## 6. Registries

Entity types: person, mission, business, skill, language, concept, document, procedure, …  
Relationship types: HAS_MISSION, HAS_SKILL, PREFERS, FOUNDER_OF, EVIDENCED_BY, DOCUMENTS, …

## 7. Contratos públicos

Ver `docs/architecture/world-model.md`

## 8. Fluxos de projeção

Memory elegível → entity/event/procedure  
Identity CONFIRMED/LEARNED → person + HAS_SKILL/PREFERS/LEARNING/HAS_GOAL  
Mission → mission + HAS_MISSION  
Business → business/workspace (+ FOUNDER_OF só se confirmado)  
Document → document + DOCUMENTS

## 9. Matriz de autoridade

Domínio edita; World Model projeta; UI corrige projeção cognitiva.

## 10–13. Resolution / dedupe / confidence / conflitos

sourceReference > externalReference > canonicalKey · nunca merge por nome  
Idempotência sem inflar confidence  
Scores separados: entity / relationship / projection  
Rejection → suppression

## 14. Consultas

Neighbors filtráveis · findPath maxDepth 2 (cap 3) · explain*

## 15–16. Privacidade / auditoria

RLS own-row · isolamento user/workspace · bloqueio clínico · audit append-only

## 17. Bootstrap / reconciliação

dry-run · lote · idempotente · reconcile por sourceReference · archive se fonte apagada

## 18. Brain

`getWorldContextForBrain` → `executionInfluence: "none"`

## 19. Testes

| Suite | Resultado |
|-------|-----------|
| `test:world` (50) | PASS |
| `test:security` | (inclui world) |
| typecheck | PASS |

## 20. Performance

Cache ~5s · limites default · path depth limitado · bootstrap em lote

## 21. Limitações

Persistência tipada best-effort · sem visualização gráfica · sem multi-hop avançado · projectors de domínio ainda seletivos

## 22. Pendências

1. Aplicar migration Supabase  
2. Regenerar tipos Database  
3. E2E UI Mapa do Aura  
4. Wire contínuo Mission/Memory → projectors

## 23. Recomendação Sprint 6.5

**Discovery Engine V1** — candidatos tipados (missão/oportunidade/risco) consumindo World Model + Memory + Identity + Intelligence, sem Execution.

## Definition of Done

- [x] Entidades / relações / registries  
- [x] Resolution + idempotência  
- [x] Projectors Memory/Identity/Mission/Business/Document  
- [x] Neighbors + findPath limitado  
- [x] Explain / correct / reject / suppression  
- [x] UI Mapa do Aura  
- [x] RLS / auditoria / bootstrap  
- [x] Brain read-only + executionInfluence none  
- [x] Testes + docs + relatório  
- [x] Sem Discovery completo / sem hardcode de usuário
