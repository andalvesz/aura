# RC1 — Aura Brain Cognitive Platform

| Campo | Valor |
|-------|-------|
| Data | 2026-07-28 |
| Status final | **APPROVED_WITH_PENDING_ITEMS** |
| Baseline | Aura Brain Architecture v1.0 |

---

## 1. Resumo executivo

RC1 consolidou o Kernel Cognitivo (Sprints 6.1–6.5) sem novas engines. Documentação Architecture v1.0, matrizes, internal API, checklist de novas engines; correções de baixo risco (UI sem stores, `executionInfluence` em Identity hints, `listWorldRelationships`, `lib/aura-kernel`); testes de regressão e contrato RC1 passando. Discovery (ADR-006) e Decision Support **não** foram iniciados.

## 2. Objetivo da RC1

Estabilizar, documentar e auditar o kernel antes de Decision Support.

## 3. Escopo executado

Inventário · auditorias · docs v1.0 · matrizes · internal-api · checklist · correções baixo risco · testes RC1 · regressão · typecheck · build.

## 4. Escopo não executado

Discovery · Decision Support · Scenario/Priority · automações · Neo4j · regeneração completa DB types · unificação total SourceReference em todos packages · Confidence Engine unificado (ADR-005).

## 5–6. Arquitetura encontrada → final

**Real:** Experience → Memory (+Promotion) → World Model → Cognitive → Brain read-only; Mission/Planner paralelos; Discovery ausente.

**Documentada v1.0:** mesmo pipeline com Discovery e Decision Support como estágios futuros explícitos.

## 7. Divergências ADR ↔ implementação

| Divergência | Severidade | Ação |
|-------------|------------|------|
| Discovery no pipeline docs vs código ausente | média (esperada) | Documentada |
| ADR-009 inexistente | info | Registrada |
| Sprint 6.6 report inexistente | info | Registrada |
| ADR-005 Confidence unificado parcial | média | Pendência |
| RFC-001 pipeline histórico | baixa | README atualizado |
| Identity hints sem executionInfluence | baixa | **Corrigida** |
| UI → stores internos | baixa | **Corrigida** |
| SourceReference duplicado ×4 | baixa | Canônico em `aura-kernel`; migração gradual |
| DB types sem tabelas 6.2–6.5 | média | Pendência |

## 8–9. Correções / arquivos

**Criados:** `lib/aura-kernel/*`, `utils/rc1-cognitive-platform.test.ts`, `docs/architecture/aura-brain-architecture-v1.md`, `matrices.md`, `internal-api-v1.md`, `new-engine-checklist.md`, este relatório.

**Alterados:** identity hints, world-model service (`listWorldRelationships`), world-map-view, insights-aura-view, `docs/adr/README.md`, `package.json`.

**Removidos:** nenhum contrato público; apenas imports de store nas UIs.

## 10–12. Contratos

STABLE / INTERNAL / LEGACY: ver `internal-api-v1.md`.  
DEPRECATED: nenhum na RC1.  
EXPERIMENTAL: nenhum novo.

## 13–18. Dependências / authority / confidence / lifecycle / suppression / execution

Ver `docs/architecture/matrices.md`.  
`executionInfluence: "none"` em Identity hints, Memory/World/Cognitive brain contexts e slices do Brain.

## 19–22. Segurança / providers / cache / UX

RLS own-row auditado via testes existentes. Providers: `none` + política documentada. Cache ~5s. UX: links cruzados Insights↔Mapa; sem redesign.

## 23. Migrations e DB types

Ordem: Identity `…200000` → Memory `…210000` → World `…220000` → Cognitive `…230000`.  
Discovery: sem migration.  
`types/database.ts`: **sem** tabelas aura_identity/memory/world/cognitive regeneradas — adapters best-effort permanecem.

## 24–26. Testes / typecheck / build

| Suite | Resultado |
|-------|-----------|
| test:identity (20) | PASS |
| test:memory (38) | PASS |
| test:world (50) | PASS |
| test:cognitive (22) | PASS |
| test:rc1 (6) | PASS |
| typecheck | PASS |
| build | PASS |
| test:discovery | **não existe** (script ausente; engine ausente) |

## 27–29. Limitações / dívidas / pendências obrigatórias

1. Implementar Discovery V1 (próxima sprint cognitiva) **ou** remover Discovery do pipeline de “implementado”.  
2. Regenerar DB types após migrations aplicadas.  
3. Confidence Engine unificado (ADR-005).  
4. Migrar engines para importar `SourceReference` de `aura-kernel`.  
5. Adotar `normalizeKernelError` gradualmente nos services.  
6. Aplicar migrations no Supabase (ambientes).

## 30–31. Prontidão Sprint 7.0 / recomendação Decision Support

**Não pronto para Decision Support até:** Discovery V1 existir **ou** Decision Support consumir apenas Cognitive+World+Identity com ADR próprio.  
Recomendação: **Sprint 6.6 Discovery Engine V1** (consumir Cognitive, sem Execution) → depois **Sprint 7.0 Decision Support Foundation**.

## Status

**APPROVED_WITH_PENDING_ITEMS** — sem falhas críticas de segurança/build/contratos; pendências documentadas (Discovery, DB types, Confidence unificado).
