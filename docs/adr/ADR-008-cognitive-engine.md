# ADR-008 — Cognitive Engine

| Campo | Valor |
|-------|-------|
| Status | Accepted |
| Sprint | 6.5 — Cognitive Engine Foundation |
| Data | 2026-07-28 |
| Depende de | ADR-001, ADR-002, ADR-003, ADR-004 (+ addenda), ADR-005, ADR-007 |
| Não implementa | Discovery Engine completo (ADR-006) |

---

## Problema

Identity, Memory e World Model fornecem fatos, claims e relações — mas o Aura Brain ainda não possui uma camada dedicada a **raciocínio explicável**: padrões, hipóteses, insights, conflitos e recomendações não executáveis.

Sem Cognitive Engine:

- Discovery / Planner tendem a reimplementar “lógica cognitiva” ad-hoc;
- insights viram texto livre sem evidência;
- correlação é confundida com causalidade;
- recomendações saltam para execução;
- o usuário não consegue revisar, rejeitar ou silenciar conclusões.

## Contexto

Pipeline oficial atualizado (Sprint 6.5):

```
Experience Layer
        ↓
Memory Engine
        ↓
Memory Promotion Engine
        ↓
World Model
        ↓
Cognitive Engine
        ↓
Discovery Engine
        ↓
Mission / Planner
        ↓
Execution
```

Identity, Memory e World Model **fornecem contexto** ao Cognitive Engine (somente leitura).  
Discovery Engine (ADR-006) **consome** artefatos cognitivos — não os duplica.

## Objetivos

1. Definir o Cognitive Engine como camada de raciocínio explicável.
2. Produzir artefatos revisáveis (padrões, hipóteses, insights, conflitos, riscos, recomendações, perguntas).
3. Garantir evidências, método, confiança e hipóteses alternativas em toda conclusão.
4. Manter LLM opcional, validado e estruturado — nunca como arquitetura.
5. Impedir qualquer influência em execução nesta sprint.

## Alternativas consideradas

### A — Expandir Discovery para “pensar”

**Rejeitada:** Discovery propõe direção/missões; misturar raciocínio epistêmico com candidatos operacionais viola separação de responsabilidades.

### B — LLM como orquestrador cognitivo

**Rejeitada:** opaco, não auditável, conflita com ADR-001 (estrutura > chat).

### C — Cognitive Engine tipado + engines determinísticos + provider opcional (escolhida)

Motores pequenos (pattern, conflict, progress, hypothesis, insight, recommendation) com Reasoning Validator obrigatório e LLM apenas como adaptador de redação/estruturação.

### D — Regras espalhadas em Intelligence

**Insuficiente:** Intelligence é percepção do *agora*; Cognitive Engine produz interpretações revisáveis com ciclo de vida.

## Decisão escolhida

Criar o **Cognitive Engine** como motor de primeira classe.

### Decisões arquiteturais obrigatórias (Sprint 6.5)

1. **Cognitive Engine é a camada responsável por raciocínio explicável.**
2. **Discovery Engine, Planner e demais consumidores não devem implementar raciocínio cognitivo duplicado.**
3. **Cognitive Engine não é um LLM, agente ou provedor específico.**
4. **Modelos de IA podem atuar como adaptadores internos, mas não são a arquitetura.**
5. **O motor deve funcionar parcialmente sem LLM por meio de regras determinísticas.**
6. **Toda conclusão deve preservar evidências, método, confiança e hipóteses alternativas.**
7. **Nenhum insight é automaticamente um fato.**
8. **Nenhuma recomendação é automaticamente uma decisão.**
9. **Nenhuma saída cognitiva influencia execução nesta sprint** (`executionInfluence: "none"`).
10. **Correções, rejeições e confirmações humanas prevalecem.**
11. **Leituras do Cognitive Engine não criam mutações nas fontes.**
12. **O Cognitive Engine pode persistir seus próprios artefatos cognitivos, mas não modificar Memory, Identity, World Model, Mission ou Planner silenciosamente.**
13. **Dados sensíveis não podem ser inferidos.**
14. **Explicações não devem revelar cadeia de pensamento privada de modelos.**
15. **As explicações devem apresentar evidências, regras, premissas e resumo da justificativa, não raciocínio interno oculto.**

### Princípios operacionais

1. Correlação ≠ causalidade.
2. Padrão ≠ verdade universal.
3. Insight ≠ decisão.
4. Recomendação ≠ execução.
5. Toda conclusão precisa de evidência + escopo temporal/contextual.
6. Evidência duplicada não aumenta confiança.
7. Ausência de evidência ≠ evidência de ausência → `UNKNOWN` / `INSUFFICIENT_EVIDENCE`.
8. Hipóteses alternativas quando relevantes.
9. Rejeições humanas impedem reapresentação repetitiva sem novas evidências (suppression).
10. Sem classificação psicológica/clínica.
11. Determinístico sempre que possível; LLM opcional, schema-validado, com fallback.
12. Conteúdo de modelo nunca substitui evidências.
13. Confiança nunca 100 para inferência.

### Artefatos

Tipos iniciais: `PATTERN`, `CONFLICT`, `PROGRESS_OBSERVATION`, `HYPOTHESIS`, `INSIGHT`, `RISK_SIGNAL`, `RECOMMENDATION`, `CLARIFYING_QUESTION`, `INSUFFICIENT_EVIDENCE`, `DATA_QUALITY_WARNING`.

Status padrão de geração: `GENERATED` ou `PENDING_REVIEW` — nunca `CONFIRMED` automático.

### Matriz de autoridade

| Camada | Autoridade | Cognitive Engine |
|--------|------------|------------------|
| Identity | Claims confirmadas | Lê |
| Memory | Memórias tipadas | Lê |
| World Model | Entidades/relações | Lê |
| Mission / Planner | Operação | Lê (contexto); não altera |
| Cognitive Engine | Artefatos cognitivos | Persistência própria |
| Discovery (futuro) | Candidatos | Consome artefatos |
| Usuário | Confirma / rejeita / corrige | Prevalece |

### Separação de confiança

| Estágio | Campo |
|---------|-------|
| Evidence | `evidenceConfidence` |
| Pattern | `patternConfidence` |
| Hypothesis | `hypothesisConfidence` |
| Insight | `insightConfidence` |
| Recommendation | `recommendationConfidence` |
| Artifact | `confidence` (calibrado pelo Validator) |

Método versionado: `confidenceMethodVersion`.

## Consequências

**Positivas**

- Raciocínio auditável e revisável antes de Discovery/Execution.
- Linguagem calibrada (associação, não causa).
- Base limpa para ADR-006 sem duplicar lógica.

**Negativas / trade-offs**

- Mais um motor e UI de revisão.
- Processamento sob demanda (sem cron obrigatório nesta sprint).
- Insights fracos exigem disciplina de `INSUFFICIENT_EVIDENCE`.

## Estratégia de evolução

1. **V1 (6.5):** fundação determinística + validator + feedback/suppression + Brain read-only.
2. **V1.1:** provider LLM opcional calibrado.
3. **6.6+:** Discovery consome artefatos (sem reimplementar raciocínio).
4. Nunca: execução automática a partir de insight.

## Compatibilidade futura

- Não altera Identity/Memory/World Model schemas de autoridade.
- Não inicia Discovery completo.
- Facade: `getCognitiveContextForBrain()` com `executionInfluence: "none"`.

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Causalidade indevida | Reasoning Validator + linguagem calibrada |
| Inferência sensível | Privacy gate (ADR-007) |
| Duplicar Discovery | ADR explícito; Discovery só consome |
| LLM inventa evidência | Schema + validator; evidências só por referência |
| Spam de insights | Fingerprint, dedupe, suppression |

## Relação com outros componentes

| Componente | Relação |
|------------|---------|
| ADR-001 | Estrutura > chat; confiança antes de ação |
| ADR-002–004 | Fontes de contexto read-only |
| ADR-005 | Confidence por estágio |
| ADR-006 | Consumidor futuro — não duplicar |
| ADR-007 | Ownership, sensibilidade, redaction |
| RFC-005 | Implementação V1 |
| Brain Core | Context slice somente leitura |

## Não-objetivos (Sprint 6.5)

Discovery completo · Opportunity Engine · criação automática de missões · alteração de agenda/finanças · execução · agentes autônomos · inferência causal definitiva · modelagem psicológica · embeddings/vector DB obrigatórios · reescrita de Identity/Memory/World Model/Planner
