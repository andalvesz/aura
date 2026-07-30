# Sprint 6.1 — Foundation ADRs

## Objetivo

Projetar a fundação definitiva do Aura Brain **antes** da implementação.

## Escopo cumprido

- Documentação apenas
- Sem código
- Sem migrations
- Sem tabelas
- Sem alteração de aplicação

## Entregáveis

### ADRs (`docs/adr/`)

| ADR | Título |
|-----|--------|
| [ADR-001](../docs/adr/ADR-001-filosofia-aura-brain.md) | Filosofia do Aura Brain |
| [ADR-002](../docs/adr/ADR-002-identity-engine.md) | Identity Engine |
| [ADR-003](../docs/adr/ADR-003-memory-engine.md) | Memory Engine |
| [ADR-004](../docs/adr/ADR-004-knowledge-graph.md) | Knowledge Graph |
| [ADR-005](../docs/adr/ADR-005-confidence-engine.md) | Confidence Engine |
| [ADR-006](../docs/adr/ADR-006-discovery-engine.md) | Discovery Engine |
| [ADR-007](../docs/adr/ADR-007-privacy-ownership.md) | Privacy & Ownership |

Cada ADR contém: Problema, Contexto, Objetivos, Alternativas, Decisão, Consequências, Estratégia de evolução, Compatibilidade futura, Riscos, Exemplos, Relação com outros componentes.

### RFC

| RFC | Título |
|-----|--------|
| [RFC-001](../docs/adr/RFC-001-foundation-pipeline.md) | Pipeline Identity → Memory → Knowledge Graph → Discovery → Mission → Planner → Execution |

### Índice

[docs/adr/README.md](../docs/adr/README.md)

## Pipeline (visão)

```
Identity
  → Memory
  → Knowledge Graph
  → Discovery
  → Mission Engine
  → Planner
  → Execution
```

Gates transversais: **Confidence** + **Privacy & Ownership**.  
Filosofia: missão > módulo; estrutura > chat; confiança antes de ação.

## Relação com o que já existe

| Existente | Papel no design |
|-----------|-----------------|
| Intelligence Engine | Percepção do *agora* (entrada de Discovery/Planner) |
| Aura Brain Core | Planner + Execution + Autonomy + Audit |
| Mission Engine V1 | Materializa direção; será alimentado por Discovery |
| Meu Dia | Superfície de working memory + missão do dia |
| Multiuser RLS | Base técnica de ADR-007 |

## Não feito (proposital)

- Implementação de engines
- Schemas / migrations / tabelas
- Escolha de vendor de grafo ou vector DB
- Mudanças em `lib/**` ou UI

## Próximo passo sugerido (fora desta sprint)

Sprints de implementação citando explicitamente ADRs/RFC, na ordem orientativa do RFC-001 §9 (Identity bootstrap → Memory → Graph → Confidence gates → Discovery → Privacy pack).

## Definition of Done

- [x] 7 ADRs completos
- [x] RFC geral do pipeline
- [x] Sem código / migrations / tabelas
- [x] Parar após a documentação
