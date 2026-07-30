# Sprint 7.0 — Decision Support Foundation

| Campo | Valor |
|-------|-------|
| Data | 2026-07-29 |
| Status | **DELIVERED** |
| Baseline | RC4.1 Documents & Knowledge Hub |
| Escopo | Decision Support read-only, engines V1, Decision Center, feedback, ranking |
| Fora de escopo | Execution · Automações · Planner · Agentes · alteração do Kernel Cognitivo · Sprint 7.1 |

---

## 1. Resumo executivo

A Sprint 7.0 inicia a camada de **apoio à decisão** do Aura Brain: consome Identity, Memory, World, Cognitive, Discovery, Knowledge, Projects e Business em modo **somente leitura**, e produz Decision Cards explicáveis com evidências, limitações e alternativas. Nenhuma sugestão executa ações, altera projetos ou cria tarefas. `executionInfluence` permanece `"none"`.

---

## 2. Arquitetura

```
lib/decision-support/
  types/          contratos DecisionCard / context / feedback
  context/        buildDecisionContext (read-only)
  engines/        7 engines V1 (registry)
  registry/       register / run sem hardcode
  validators/     evidence + confidence + limitations + alternatives
  providers/      collectDecisionSources
  services/       facade de geração / listagem / feedback
  engine.ts       orquestração generate/list/get/home
  ranking.ts      impacto · urgência · confiança · esforço · reversibilidade
  feedback.ts     accept / ignore / archive / request_review + audit
  explain.ts      por que / evidências / limitações
  search.ts       busca local
  store.ts        in-memory por user/workspace
```

Fluxo: **Sources (RO) → Context → Registry → Validator → Rank → UI**.

Relações: Decision → Projeto → Discovery → Knowledge → Memory → World (links no card; sem escrita).

---

## 3. Engines V1

| Engine | ID | Papel |
|--------|-----|--------|
| Priority | `priority_v1` | Prioridades sugeridas — nunca cria tarefas |
| Tradeoff | `tradeoff_v1` | Vantagens / desvantagens / riscos / incertezas |
| Review | `review_v1` | “Esta decisão merece revisão.” |
| Opportunity Ranking | `opportunity_ranking_v1` | Ranking de oportunidades |
| Risk Ranking | `risk_ranking_v1` | Ranking de riscos |
| Missing Information | `missing_information_v1` | “Faltam informações para decidir.” |
| Stale Decision | `stale_decision_v1` | Sinais / docs possivelmente desatualizados |

Todas registradas via `ensureBuiltinDecisionEngines()` — sem hardcode no orquestrador.

---

## 4. Decision Center

| Rota | Status |
|------|--------|
| `/dashboard/decisions` | ✅ |
| `/dashboard/decisions/:id` | ✅ |
| Nav Aura Brain | ✅ |

Decision Cards incluem: id, title, summary, context, confidence, impact, urgency, effort, reversibility, evidence, limitations, alternativeOptions, status, **executionInfluence: "none"**.

---

## 5. Feedback

Aceitar · Ignorar · Arquivar · Solicitar revisão — com histórico em `feedback` + `audit`.

---

## 6. Ranking

Score composto: impacto, urgência, confiança, esforço (menor esforço favorece), reversibilidade.

---

## 7. Explicação & Validator

Toda sugestão expõe: por que apareceu, evidências, limitações, alternativas.

Validator rejeita cards sem `evidence`, `confidence`, `limitations`, `alternativeOptions`, ou com `executionInfluence ≠ "none"`.

---

## 8. Home & Busca

Widgets Home: Decisões prioritárias · Em revisão · Dados insuficientes.

Global Search: entidade `aura_decisions`.

---

## 9. Performance & Segurança

- Geração sob demanda; dedupe por fingerprint
- Paginação/list limits
- Visibility PRIVATE (default); RLS migration preparada
- `supabase/migrations/20260729230000_sprint7_decision_support.sql`
- Constraint SQL: `execution_influence = 'none'`

---

## 10. Testes

| Suite | Resultado |
|-------|-----------|
| `npm run test:decision` | **PASS** (14) |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** (confirmação na entrega) |

Cobertura: Registry, Priority, Tradeoff, Ranking, Feedback, Busca, Workspace/RLS mirrors, Validator, UI contracts, `executionInfluence: none`.

---

## 11. Pendências

- Persistência Supabase wired (store in-memory + migration pronta)
- Identity hints via provider dedicado (hoje opcional/vazio no service)
- E2E Playwright do Decision Center
- Sprint 7.1: refinamentos de ranking, mais engines, colaboração

---

## 12. Prontidão para Sprint 7.1

**Parcial / foundation pronta.** Decision Support utilizável como apoio explicável.

**Não iniciar Sprint 7.1 nesta entrega.** Gates: sem Planner, sem automações, sem agentes, sem Execution; Kernel Cognitivo intocado; `executionInfluence: "none"`.

---

## Definition of Done

| Critério | Status |
|----------|--------|
| Decision Center funcional | ✅ |
| Priority Engine | ✅ |
| Tradeoff Engine | ✅ |
| Ranking | ✅ |
| Feedback | ✅ |
| Busca integrada | ✅ |
| Home integrada | ✅ |
| Explicações completas | ✅ |
| Validator funcionando | ✅ |
| Testes PASS | ✅ |
| Typecheck PASS | ✅ |
| Build PASS | ✅ |
| `executionInfluence` continua `"none"` | ✅ |
| Planner / automações / agentes não implementados | ✅ |
