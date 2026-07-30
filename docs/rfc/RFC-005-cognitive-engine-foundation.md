# RFC-005 — Cognitive Engine Foundation (Sprint 6.5)

| Campo | Valor |
|-------|-------|
| Status | Implemented (V1) |
| Data | 2026-07-28 |
| Base | ADR-001, ADR-005, ADR-007, ADR-008, RFC-001–004 |
| Código | `lib/cognitive/*`, `lib/supabase/services/cognitive-engine.service.ts` |

---

## 1. Resumo

Implementa Cognitive Engine V1: Context Builder, Artifact Model, Pattern/Conflict/Progress/Hypothesis/Insight/Recommendation engines, Reasoning Validator, Evidence Resolver, Confidence Calculator, feedback/suppression, provider opcional (`none`), UI **Insights do Aura**, RLS e Brain read-only (`executionInfluence: "none"`).

## 2. Decisões

1. Cognitive Engine = raciocínio explicável; não é LLM/agente.
2. Discovery/Planner não duplicam raciocínio cognitivo.
3. Fontes (Identity/Memory/World/Mission) são somente leitura.
4. Persistência própria de artefatos; sem mutação silenciosa de outras engines.
5. LLM opcional via `CognitiveReasoningProvider` com fallback determinístico.
6. Sem hardcode de usuários/exemplos de domínio no código.

## 3. Pipeline oficial

```
Experience → Memory → Promotion → World Model → Cognitive Engine → Discovery → Mission/Planner → Execution
```

## 4. Contratos públicos

`buildCognitiveContext` · `generateCognitiveArtifacts` · `detectPatterns` · `detectConflicts` · `analyzeProgress` · `generateHypotheses` · `generateInsights` · `generateRecommendations` · `validateCognitiveArtifact` · `get/list/searchCognitiveArtifacts` · `explainCognitiveArtifact` · `confirm/correct/reject/archive/delete` · `submitCognitiveFeedback` · `suppressSimilarArtifacts` · `revalidateCognitiveArtifact` · `getCognitiveContextForBrain` · `bootstrapCognitiveEngine`

## 5. Migrations

`supabase/migrations/20260728230000_cognitive_engine_v1.sql`

## 6. Próximo (fora deste RFC)

Sprint 6.6 sugerida: Discovery Engine V1 consumindo artefatos cognitivos — sem reimplementar raciocínio.
