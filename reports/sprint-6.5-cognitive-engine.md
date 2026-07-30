# Sprint 6.5 — Cognitive Engine Foundation

## 1. Resumo executivo

Cognitive Engine V1 funcional: Context Builder, Artifact Model, Pattern/Conflict/Progress/Hypothesis/Insight/Recommendation engines, Reasoning Validator obrigatório, Evidence Resolver, Confidence Calculator versionado, feedback/suppression, provider opcional (`none`), UI **Insights do Aura**, RLS, bootstrap sob demanda e Brain read-only (`executionInfluence: "none"`).

Sem Discovery completo, sem criação de missões, sem execução, sem hardcode de usuário/domínio.

## 2. ADR do Cognitive Engine

`docs/adr/ADR-008-cognitive-engine.md` — 15 decisões arquiteturais + princípios operacionais.

## 3. Arquitetura implementada

```
UI /dashboard/settings/insights
  → app/actions/cognitive.ts
  → cognitive-engine.service.ts
  → lib/cognitive (context, engines, validator, store)
  → Identity + Memory + World Model (read-only)
  → persistência aura_cognitive_*
  → runAuraBrain({ cognitive })  // context only
```

Pipeline oficial:

```
Experience → Memory → Promotion → World Model → Cognitive Engine → Discovery → Mission/Planner → Execution
```

## 4. Arquivos criados e alterados

**Novos:** `lib/cognitive/*`, `lib/supabase/services/cognitive-engine.service.ts`, `app/actions/cognitive.ts`, `components/dashboard/cognitive/*`, `app/dashboard/settings/insights/page.tsx`, migration, `utils/cognitive-engine.test.ts`, ADR-008, RFC-005, architecture doc, este relatório.

**Alterados:** `lib/aura-brain/core.ts`, `lib/aura-brain/types.ts`, `aura-brain-core.service.ts`, `aura-brain/page.tsx`, `package.json`, `docs/adr/README.md`.

## 5. Migrations

`supabase/migrations/20260728230000_cognitive_engine_v1.sql`

Tabelas: `aura_cognitive_artifacts`, `aura_cognitive_evidence`, `aura_cognitive_feedback`, `aura_cognitive_suppressions`, `aura_cognitive_runs`, `aura_cognitive_audit` + RLS + índices (fingerprint único, type, status, confidence, suppression_key, workspace).

## 6. Cognitive Artifact Model

Tipos: PATTERN, CONFLICT, PROGRESS_OBSERVATION, HYPOTHESIS, INSIGHT, RISK_SIGNAL, RECOMMENDATION, CLARIFYING_QUESTION, INSUFFICIENT_EVIDENCE, DATA_QUALITY_WARNING.

`executionInfluence` fixo em `"none"`. Sem chain-of-thought persistido.

## 7. Engines implementados

| Engine | Módulo |
|--------|--------|
| Pattern | `patterns.ts` |
| Conflict | `conflicts.ts` |
| Progress | `progress.ts` |
| Hypothesis | `hypotheses.ts` |
| Insight | `insights.ts` |
| Recommendation | `recommendations.ts` |

## 8. Cognitive Context Builder

`buildCognitiveContext` — carrega Identity/Memory/World/Mission com budget, exclusão de rejeitados, evidenceIndex, dataCompleteness.

## 9. Evidence Resolver

`evidence.ts` — evidências normalizadas por referência, `independenceKey`, hash de conjunto.

## 10. Confidence Calculator

`confidence.ts` — scores por estágio (evidence/pattern/hypothesis/insight/recommendation), `confidenceMethodVersion`, sem boost por duplicata, teto 95 para inferência.

## 11. Reasoning Validator

25 checagens conceituais cobertas (ownership, evidence, causalidade, sensível, suppression, action boundary, etc.). Disposições: ACCEPT / REVISE / PENDING_REVIEW / INSUFFICIENT_EVIDENCE / BLOCKED / SUPPRESSED.

## 12. Hipóteses alternativas

Sempre registradas em HYPOTHESIS/INSIGHT com critérios de falsificação.

## 13. Feedback e suppression

Feedback tipado; `suppress_similar` cria suppression; rejeição impede reapresentação sem nova evidência/expiração/pedido explícito.

## 14. Provider opcional

`CognitiveReasoningProvider` + `NoneReasoningProvider`; timeout, redaction, schema validation; confiança do modelo ignorada.

## 15. Proteção contra prompt injection

Texto de memória/documento tratado como dados; sanitização; sem tool use pelo provider.

## 16. Contratos públicos

Ver `docs/architecture/cognitive-engine.md` / RFC-005.

## 17. UI

`/dashboard/settings/insights` — Insights do Aura (visão geral, padrões, insights, hipóteses, progresso, conflitos, recomendações, revisão, confirmados, rejeitados, arquivados).

## 18. Integração com Brain

`getCognitiveContextForBrain` → slice `cognitive` com `executionInfluence: "none"`.

## 19. Privacidade e segurança

ADR-007: RLS own-row, isolamento user/workspace, bloqueio de inferência sensível/clínica, redaction para provider.

## 20. Auditoria

Eventos: context_built, pattern/conflict/progress/hypothesis/insight/recommendation generated, validated/blocked/revised/confirmed/corrected/rejected/suppressed/archived/outdated/deleted, feedback, revalidation.

## 21. Testes

| Suite | Resultado |
|-------|-----------|
| `test:cognitive` (22) | PASS |
| typecheck | (após correções UI/engine) |

## 22. Performance

Cache ~5s · limites default · contexto capped · fingerprint/idempotência · processamento sob demanda (sem cron).

## 23. Limitações conhecidas

- Persistência tipada best-effort (padrão 6.2–6.4)
- Provider real de LLM não ligado (apenas `none`)
- Heurísticas de conflito textual simples
- Sem processamento contínuo

## 24. Pendências

1. Aplicar migration Supabase
2. Regenerar tipos Database
3. E2E UI Insights do Aura
4. Wire contínuo opcional de eventos → análise sob demanda

## 25. Recomendação para a Sprint 6.6

**Discovery Engine V1** — candidatos tipados (missão/oportunidade/risco) **consumindo** artefatos do Cognitive Engine + World Model + Memory + Identity + Intelligence, sem reimplementar raciocínio e sem Execution.

## Definition of Done

- [x] Context Builder / Artifact Model / engines V1
- [x] Reasoning Validator obrigatório
- [x] Evidências, alternativas, confidence por estágio
- [x] Feedback + suppression + revalidation
- [x] Provider opcional + fallback
- [x] UI Insights do Aura
- [x] RLS / auditoria / bootstrap
- [x] Brain read-only + executionInfluence none
- [x] Testes + docs + relatório
- [x] Sem Discovery completo / sem hardcode de usuário
