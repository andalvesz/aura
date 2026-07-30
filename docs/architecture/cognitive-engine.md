# Cognitive Engine — Documentação técnica

**Sprint:** 6.5  
**ADRs:** 001, 005, 007, 008 · **RFC:** 001, 005  
**Facade:** `getCognitiveContextForBrain()` / `bootstrapCognitiveEngine()`

## O que é

O **Cognitive Engine** produz artefatos cognitivos revisáveis (padrões, hipóteses, insights, conflitos, recomendações) a partir de Identity, Memory e World Model.  
Não é um LLM. Não executa. Não cria missões. `executionInfluence: "none"`.

## Pipeline

```
Experience → Memory → Promotion → World Model → Cognitive Engine → Discovery → Mission/Planner → Execution
```

## Pacote `lib/cognitive/`

| Módulo | Função |
|--------|--------|
| `types.ts` | CognitiveArtifact e contratos |
| `context.ts` | Context Builder |
| `evidence.ts` | Evidence Resolver |
| `confidence.ts` | Confidence Calculator versionado |
| `validation.ts` | Reasoning Validator |
| `patterns.ts` | Pattern Engine V1 |
| `conflicts.ts` | Conflict Engine V1 |
| `progress.ts` | Progress Engine V1 |
| `hypotheses.ts` | Hypothesis Engine V1 |
| `insights.ts` | Insight Engine V1 |
| `recommendations.ts` | Recommendation Engine V1 |
| `feedback.ts` | Feedback + suppression |
| `explain.ts` | Explicações sem chain-of-thought |
| `providers/` | Provider opcional (`none`) |
| `engine.ts` | Orquestração Pure |
| `store.ts` | Estado + cache 5s |

## UI

`/dashboard/settings/insights` — **Insights do Aura**

## Migrations

`supabase/migrations/20260728230000_cognitive_engine_v1.sql`

## Testes

```bash
npm run test:cognitive
```

## Não faz

Discovery completo · criação de missões · execução · inferência causal definitiva · classificação psicológica · mutação de Identity/Memory/World Model
