# Sprint 7.1 — Scenario Engine

| Campo | Valor |
|-------|-------|
| Data | 2026-07-29 |
| Status | **DELIVERED** |
| Baseline | Sprint 7.0 Decision Support Foundation |
| Escopo | Scenario Engine, What-If, comparação, Scenario Center |
| Fora de escopo | Execution · Planner · Automações · Agentes · Kernel Cognitivo · Sprint 7.2 |

---

## 1. Resumo executivo

A Sprint 7.1 adiciona **simulação hipotética** ao Aura Brain: o usuário explora “o que pode acontecer se…” antes de decidir. Cenários são gerados a partir de Projects, Business, Discovery, Knowledge, Memory, World e Decision Support — **somente leitura**. O Aura nunca responde “faça isso”. `executionInfluence` permanece `"none"`.

---

## 2. Arquitetura

```
lib/scenario/
  types/       ScenarioCard, What-If, comparison
  context/     buildScenarioContext (read-only)
  engines/     typed (6) + what_if + comparison
  registry/    register / run sem hardcode
  validators/  assumptions + limitations + confidence + evidence
  providers/   collectScenarioSources
  services/    facade simulate / compare / feedback
  engine.ts    orquestração
  compare.ts   vantagens / desvantagens / riscos / oportunidades
  feedback.ts  save · archive · compare · discard + audit
  explain.ts   dados usados / ignorados / por quê
  search.ts    busca
  store.ts     in-memory
```

Relações: Scenario → Decision → Project → Discovery → Knowledge → Memory.

---

## 3. Simulation Engine & tipos

| Tipo | Engine |
|------|--------|
| Best Case | `best_case_v1` |
| Worst Case | `worst_case_v1` |
| Most Likely | `most_likely_v1` |
| Optimistic | `optimistic_v1` |
| Conservative | `conservative_v1` |
| Neutral | `neutral_v1` |
| What-If (ramos) | `what_if_v1` |
| Comparison seed | `comparison_v1` |

Impacto relativo: LOW / MEDIUM / HIGH — **sem valores financeiros automáticos**.

---

## 4. Scenario Center

| Rota | Status |
|------|--------|
| `/dashboard/scenarios` | ✅ |
| `/dashboard/scenarios/:id` | ✅ |
| Nav Aura Brain | ✅ |
| What-If form | ✅ |
| Comparação multi-select | ✅ |

Cada cenário: id, title, description, status, context, confidence, assumptions, limitations, alternativeScenarios, relatedDecision/Project/Discovery, evidence, timeline, uncertainty, **executionInfluence: "none"**.

---

## 5. Comparações

`compareScenariosPure` produz: vantagens, desvantagens, riscos, oportunidades, dados insuficientes — com auditoria e `executionInfluence: none`.

---

## 6. Home & Busca

- Widget Home: **Últimos cenários**
- Global Search: `aura_scenarios`

---

## 7. Validator & Segurança

Validator exige: assumptions, limitations, confidence, evidence (+ whyResult, executionInfluence none).

Migration RLS: `supabase/migrations/20260729240000_sprint7_1_scenario_engine.sql` com check `execution_influence = 'none'`.

---

## 8. Performance

- Geração sob demanda; dedupe por fingerprint
- Limits em listagens
- Store in-memory (padrão Sprint 7.0)

---

## 9. Testes

| Suite | Resultado |
|-------|-----------|
| `npm run test:scenario` | **PASS** (10) |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** |

Cobertura: Registry, Simulation, What-If, Comparison, Validator, Busca, Feedback, Workspace/RLS, UI contracts.

---

## 10. Pendências

- Persistência Supabase wired
- E2E Playwright do Scenario Center
- Monte Carlo / quantitativo (fora de escopo 7.1)
- Sprint 7.2: refinamentos de comparação e ligação Decision↔Scenario

---

## 11. Prontidão para Sprint 7.2

**Foundation pronta.** Scenario Engine utilizável para exploração hipotética.

**Não iniciar Sprint 7.2 nesta entrega.** Gates: sem Planner, sem automações, sem agentes, sem Execution; Kernel Cognitivo intocado; `executionInfluence: "none"`.

---

## Definition of Done

| Critério | Status |
|----------|--------|
| Scenario Center funcional | ✅ |
| Simulation Engine | ✅ |
| What If | ✅ |
| Comparação de cenários | ✅ |
| Feedback | ✅ |
| Busca integrada | ✅ |
| Home integrada | ✅ |
| Validator funcionando | ✅ |
| Testes PASS | ✅ |
| Typecheck PASS | ✅ |
| Build PASS | ✅ |
| `executionInfluence` continua `"none"` | ✅ |
| Planner / automações / agentes não implementados | ✅ |
