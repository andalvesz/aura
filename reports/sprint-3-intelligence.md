# Sprint 3 — Aura Intelligence Engine V1

## Objetivo

Motor central de inteligência **desacoplado** que analisa DTOs do usuário e produz objeto estruturado (`priorities`, `alerts`, `recommendations`, `insights`, `score`).  
**Não** é chatbot. **Sem** OpenAI. **Sem** acesso direto ao banco.

## Arquitetura

```
lib/intelligence/
  types.ts              # contratos + ExplainWithAI (stub futuro)
  rules.ts              # plugins PASS|WARNING|FAIL
  priorities.ts         # CRITICAL|HIGH|MEDIUM|LOW
  alerts.ts             # alertas estruturados
  recommendations.ts    # sugestões baseadas em dados
  insights.ts           # insights derivados
  score.ts              # índice 0–100 por dimensão
  cache.ts              # cache in-memory por user+context
  map.ts                # MyDay / Workspace → DTO
  engine.ts             # runAuraIntelligenceEngine()
  index.ts              # superfície pública
  services/
    intelligence.service.ts  # getAuraIntelligence()
```

**Consumo do sistema:** apenas `getAuraIntelligence()` (ou `getAuraIntelligenceFromMyDay` para evitar double-fetch no Meu Dia).

```
Services (DTOs) → getAuraIntelligence → Engine (regras) → AuraIntelligenceResult
```

## Regras criadas (plugins)

| Regra | Módulo | Gatilho |
|-------|--------|---------|
| `BudgetCriticalRule` | financeiro | orçamento ≥80% / estourado |
| `OverdueEventRule` | calendario | eventos atrasados |
| `CalendarConflictRule` | calendario | sobreposição de horários |
| `HabitBrokenRule` | habitos | hábitos com data < hoje |
| `WorkoutOverdueRule` | saude | treino pendente / ≥3 dias |
| `GoalDeadlineRule` | objetivos | prazo ≤7 dias ou behind |
| `TripSoonRule` | viagens | viagem ≤14 dias |
| `LanguageStreakRule` | idiomas | prática do dia pendente |
| `ExpertBrainErrorRule` | expert_brain | erros de ingestão |
| `ExpertBrainQueueRule` | expert_brain | fila parada / processando |
| `WorkspaceEstoqueRule` | workspace | estoque crítico |
| `WorkspaceFollowUpRule` | workspace | follow-ups pendentes |
| `WorkspacePropostasRule` | workspace | propostas em aberto |

## Prioridades suportadas

`CRITICAL` · `HIGH` · `MEDIUM` · `LOW`

Exemplos cobertos: evento atrasado, conta/orçamento crítico, treino atrasado, meta próxima, viagem <7 dias, Expert Brain com erro, fila parada, conflito de agenda.

## Alertas

Objetos `{ type, severity, module, title, description, action, target }` — nunca texto de chat.

## Recomendações

Somente com dados: concluir hábito, treinar hoje, atualizar objetivo, revisar orçamento, estudar inglês, processar documentos, preparar viagem, follow-up/estoque (workspace).

## Insights suportados

- Gasto do mês / maior categoria  
- Melhor sequência de hábitos  
- Meta mais próxima  
- Semana carregada (eventos)  
- Intervalo desde o último treino  
- Volume de documentos Expert Brain  
- Sequência de idiomas / countdown de viagem  
- Propostas / eventos (workspace)

## Score (0–100, só regras)

| Dimensão | Base |
|----------|------|
| financeiro | orçamento + regras finance |
| saude | treino + hábitos |
| produtividade | objetivos + calendário |
| aprendizado | idiomas + expert brain |
| organizacao | agenda + viagens + fila |
| consistencia | streaks |
| **overall** | média das dimensões |

## Performance

| Métrica | Valor |
|---------|-------|
| Tempo médio do engine (100 runs fixtures) | **~0,34 ms** |
| Max observado no bench | 23 ms |
| Teste de regressão | avg < 50 ms |
| Cache TTL | 60 s por `userId::context` |
| Invalidação | `invalidateAuraIntelligenceCache(userId)` após hábito/objetivo no Meu Dia |

## Integração UI

- `components/dashboard/my-day.tsx` consome `getAuraIntelligenceFromMyDay`
- Prioridades do engine substituem a lista legada na home
- Cards de Alertas + Recomendações
- Índice de saúde no header (`Índice N/100`)
- `data-testid`: `intelligence-priorities`, `intelligence-alerts`, `intelligence-recommendations`

## Arquivos criados / alterados

**Novos**

- `lib/intelligence/*` (camada completa)
- `utils/intelligence-engine.test.ts`
- `utils/intelligence-fixtures.ts`
- `e2e/intelligence.spec.ts`
- `reports/sprint-3-intelligence.md`

**Alterados**

- `components/dashboard/my-day.tsx`
- `components/dashboard/dashboard-card.tsx` (`testId`)
- `app/actions/my-day.ts` (invalidação de cache)
- `package.json` (`test:intelligence`, suites)

## Testes

| Suite | Resultado |
|-------|-----------|
| `test:intelligence` (14) | PASS |
| `test:security` (63) | PASS |
| `typecheck` | PASS |
| `build` | PASS |
| `audit:ui` | PASS (failures=0) |
| Playwright intelligence + my-day | 1 passed · 4 skipped (sem `.env.e2e`) |

Cenários unitários: usuário vazio, saudável, financeiro crítico, hábitos atrasados, objetivos próximos, viagem próxima, Expert Brain parado, múltiplos alertas, conflitos de calendário, workspace, cache, score, performance.

## Futuro (não implementado)

```ts
type ExplainWithAI = (input: ExplainWithAIInput) => Promise<{ explanation: string }>
```

Tipos exportados em `lib/intelligence/types.ts`. **Não** há implementação nem dependência de OpenAI nesta sprint.

## Pendências

1. Preencher `.env.e2e` para E2E autenticado (prioridades/alertas com dados reais)
2. Enriquecer DTO com eventos timed no agregador Meu Dia (conflitos reais além de testes)
3. Invalidar cache também em create gasto/evento/treino/documento (além de hábito/objetivo)
4. `ExplainWithAI()` — Sprint futura
5. Expert Brain V2 — **não iniciado** (conforme escopo)

## Definition of Done

- [x] Engine desacoplado  
- [x] Sem OpenAI  
- [x] Sem banco no engine  
- [x] Cobertura de testes  
- [x] Typecheck  
- [x] Build  
- [x] Playwright (specs; auth skipped sem creds)  
- [x] Audit UI  
- [x] Relatório final  
