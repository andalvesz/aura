# Sprint 7.3 — Recommendation Engine

**Status:** ✅ Concluída  
**Data:** 2026-07-31  
**executionInfluence:** `none` (em todos os artefatos)

---

## 1. Objetivo

Transformar Discovery + Decision Support + Scenario + Prioritization em **recomendações inteligentes** que respondem:

> **"O que faz mais sentido considerando tudo que eu sei até agora?"**

Nunca:

> "Estou fazendo isso por você."

Fora de escopo (não implementado): Planner · Execution · Automações · Agentes · criação de tarefas · alterações no Kernel Cognitivo.

---

## 2. Entregas

| Item | Status |
|------|--------|
| `lib/recommendation/` (context, engines, registry, validators, providers, services, types) | ✅ |
| Recommendation Center `/dashboard/recommendations` | ✅ |
| Recommendation View `/dashboard/recommendations/[id]` | ✅ |
| 6 engines (Opportunity, Risk, Project, Learning, Relationship, Review) | ✅ |
| Feedback auditável (accept / ignore / archive / request_review) | ✅ |
| Contradições (ambas mantidas, sem auto-escolha) | ✅ |
| Explainability ("Como o Aura chegou nessa recomendação?") | ✅ |
| Busca global (`aura_recommendations`) | ✅ |
| Home widget "Recomendações da semana" | ✅ |
| Validator (evidence, confidence, limitations, alternatives, reasoning) | ✅ |
| SQL + RLS (`aura_recommendation_*`) | ✅ |
| `test:recommendation` | ✅ PASS (16) |
| Typecheck | ✅ PASS |
| Build | ✅ PASS |

---

## 3. Arquitetura

```
Sources (RO) → buildRecommendationContext → runRecommendationRegistry
  → filterValidRecommendationCandidates → annotateConflicts
  → fingerprint dedupe → RecommendationCard
  → rank → UI / feedback / search / explain
```

**Fontes (somente leitura):** Identity · Memory · World · Cognitive · Discovery · Knowledge · Projects · Business · Decision · Scenario · Prioritization.

**Nunca escreve** nessas camadas.

---

## 4. Recommendation Card

Campos: `id`, `title`, `summary`, `recommendationType`, `confidence`, `priorityScore`, `impact`, `urgency`, `effort`, `reversibility`, `evidence`, `limitations`, `alternatives`, `reasoning`, `relatedDecision`, `relatedScenario`, `relatedPriority`, `relatedProject`, `relatedDiscovery`, `executionInfluence`, `conflicts`, `pipelineSteps`.

Sempre: `executionInfluence = "none"`.

---

## 5. Engines (Registry)

| Engine | Type | Papel |
|--------|------|-------|
| `opportunity_recommender_v1` | OPPORTUNITY | Sugere oportunidades |
| `risk_recommender_v1` | RISK | Sugere riscos |
| `project_recommender_v1` | PROJECT | Atenção a projetos |
| `learning_recommender_v1` | LEARNING | Lacunas / revisão de conhecimento |
| `relationship_recommender_v1` | RELATIONSHIP | Entidades/pessoas |
| `review_recommender_v1` | REVIEW | Revisão humana de artefatos |

Interface única: `RecommendationEngine.recommend(context, options)`.

---

## 6. Reasoning & Contradições

Toda recomendação explica: por que surgiu, evidências, critérios, lacunas, alternativas.

Se OPPORTUNITY↔RISK (ou pares documentados) compartilham fontes: **ambas aparecem** com `conflicts[]` explicando o conflito. O Aura **não escolhe**.

---

## 7. Feedback

`accept` → ACCEPTED · `ignore` → IGNORED · `archive` → ARCHIVED · `request_review` → NEEDS_REVIEW.

Todas as ações geram audit trail. Reafirmam `executionInfluence: "none"`.

---

## 8. Segurança

- TypeScript literal `"none"`
- Validator rejeita qualquer outro valor
- SQL CHECK + RLS `with check (execution_influence = 'none')`
- Workspace visibility (`PRIVATE` / `WORKSPACE`)
- Runtime in-memory; migration prepara persistência

---

## 9. Performance

- Cache in-memory por user/workspace
- Paginação no Recommendation Center (pageSize 12)
- Lazy loading de fontes via dynamic import no service

---

## 10. Arquivos principais

- `lib/recommendation/**`
- `app/dashboard/recommendations/**`
- `components/dashboard/recommendations/**`
- `app/actions/recommendation.ts`
- `supabase/migrations/20260730260000_sprint7_3_recommendation.sql`
- `utils/sprint7.3-recommendation.test.ts`

---

## 11. Definition of Done

✔ Recommendation Center funcional  
✔ Recommendation Engine + Registry  
✔ Feedback + Explainability  
✔ Busca integrada  
✔ Home integrada  
✔ Testes PASS (16)  
✔ Typecheck PASS  
✔ Build PASS  
✔ `executionInfluence` continua `"none"`  
✔ Sem Planner / automações / agentes  
