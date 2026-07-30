# Sprint 7.2 — Prioritization Engine

**Status:** ✅ Concluída  
**Data:** 2026-07-29  
**executionInfluence:** `none` (em todos os artefatos)

---

## 1. Objetivo

Transformar Discovery, Decision Support e Scenarios em uma **fila inteligente de prioridades** que responde:

> **"O que merece mais atenção agora?"**

Nunca:

> "Faça isto."

Fora de escopo (não implementado): Planner · Execution · Automações · Agentes · alterações no Kernel Cognitivo.

---

## 2. Entregas

| Item | Status |
|------|--------|
| `lib/prioritization/` (context, engines, registry, validators, providers, services, types) | ✅ |
| Priority Center `/dashboard/priorities` | ✅ |
| Priority View `/dashboard/priorities/[id]` | ✅ |
| 7 engines (Impact, Urgency, Confidence, Opportunity, Risk, Review, Stale) | ✅ |
| Score transparente documentado | ✅ |
| Feedback auditável | ✅ |
| Comparação de prioridades | ✅ |
| Busca global (`aura_priorities`) | ✅ |
| Home widget "Prioridades da semana" | ✅ |
| Validator (evidence, limitations, confidence, score) | ✅ |
| SQL + RLS (`aura_priority_*`) | ✅ |
| `test:prioritization` | ✅ PASS (18) |
| Typecheck | ✅ PASS |
| Build | ✅ PASS |

---

## 3. Arquitetura

```
Sources (RO) → buildPriorityContext → runPriorityRegistry
  → filterValidPriorityCandidates → fingerprint dedupe → PriorityItem
  → rankPriorityItems → UI / feedback / search / compare
```

**Fontes (somente leitura):** Identity · Memory · World · Cognitive · Discovery · Knowledge · Projects · Business · Decision Support · Scenario.

**Nunca escreve** nessas camadas.

---

## 4. Priority Item

Campos principais: `id`, `title`, `summary`, `priorityScore`, `confidence`, `impact`, `urgency`, `effort`, `reversibility`, `attentionReason`, `evidence`, `limitations`, `alternativeViews`, `relatedDecision`, `relatedScenario`, `relatedProject`, `relatedDiscovery`, `executionInfluence`.

Sempre: `executionInfluence = "none"`.

---

## 5. Score transparente (`SCORE_WEIGHTS`)

| Critério | Fórmula | Peso |
|----------|---------|------|
| impact | LEVEL(1–3) × 20 | 20 |
| urgency | LEVEL(1–3) × 18 | 18 |
| confidence | (0–100) × 0.35 | 0.35 |
| effort | (4 − LEVEL) × 8 | 8 |
| reversibility | REV(HIGH=3…LOW=1) × 6 | 6 |
| recency | factor(0–1) × 10 | 10 |
| completeness | (0–100) × 0.15 | 0.15 |

Pesos **fixos no código** (`lib/prioritization/ranking.ts`). Nenhuma IA inventa pesos em runtime.

---

## 6. Engines (Registry)

| Engine | Kind | Papel |
|--------|------|-------|
| `impact_prioritizer_v1` | IMPACT | Atenção por impacto |
| `urgency_prioritizer_v1` | URGENCY | Urgência relativa |
| `confidence_prioritizer_v1` | CONFIDENCE | Evidência sólida |
| `opportunity_prioritizer_v1` | OPPORTUNITY | Oportunidades |
| `risk_prioritizer_v1` | RISK | Riscos |
| `review_prioritizer_v1` | REVIEW | Revisões humanas |
| `stale_prioritizer_v1` | STALE | Sinais desatualizados |

Interface única: `PriorityEngine.prioritize(context, options)`.

---

## 7. Feedback

`confirm` → CONFIRMED · `ignore` → IGNORED · `archive` → ARCHIVED · `request_review` → NEEDS_REVIEW.

Todas as ações geram audit trail. Reafirmam `executionInfluence: "none"`.

---

## 8. Segurança

- TypeScript literal `"none"`
- Validator rejeita qualquer outro valor
- SQL CHECK + RLS `with check (execution_influence = 'none')`
- Workspace visibility (`PRIVATE` / `WORKSPACE`)
- Runtime ainda in-memory; migration prepara persistência

---

## 9. Performance

- Cache in-memory por user/workspace
- Paginação no Priority Center (pageSize 12)
- Lazy loading de fontes via dynamic import no service
- Limites de geração (`maxPerEngine`, slice 400 itens)

---

## 10. Testes

```bash
npm run test:prioritization
```

Cobertura: Registry · Score · Ranking · Validator · Feedback · Busca · Home · Workspace/RLS · Comparação · Explanation · UI contracts · Typecheck surface.

Também: `npm run typecheck` · `npm run build`.

---

## 11. Gates mantidos

- ❌ Planner
- ❌ Execution
- ❌ Automações
- ❌ Agentes
- ❌ Kernel Cognitivo alterado
- ✔ `executionInfluence` permanece `"none"`

---

## 12. Próximo (fora desta sprint)

Não iniciar Planner / Execution / Automações nesta entrega.
