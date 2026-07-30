# Aura Brain — Architecture Decision Records (Foundation)

**Sprint 6.1:** ADRs de design (pré-implementação)  
**Sprint 6.2:** Identity Engine V1 — [RFC-002](../rfc/RFC-002-identity-engine-implementation.md) · [architecture/identity-engine.md](../architecture/identity-engine.md)  
**Sprint 6.3:** Memory Engine V1 — [RFC-003](../rfc/RFC-003-memory-engine-implementation.md) · [architecture/memory-engine.md](../architecture/memory-engine.md)  
**Sprint 6.4:** World Model Foundation — [RFC-004](../rfc/RFC-004-world-model-foundation.md) · [architecture/world-model.md](../architecture/world-model.md)  
**Sprint 6.5:** Cognitive Engine Foundation — [RFC-005](../rfc/RFC-005-cognitive-engine-foundation.md) · [architecture/cognitive-engine.md](../architecture/cognitive-engine.md)  
**RC1:** Cognitive Platform consolidation — [Architecture v1.0](../architecture/aura-brain-architecture-v1.md) · [report](../../reports/rc1-cognitive-platform.md)  
**RC2:** Discovery Platform MVP — [ADR-006](./ADR-006-discovery-engine.md) · [report](../../reports/rc2-discovery-platform.md)

Os ADRs continuam sendo a **fonte oficial de decisão**. Implementações não alteram princípios sem novo ADR.

## Pipeline oficial

```
Experience Layer → Memory Engine → Memory Promotion Engine → World Model
    → Cognitive Engine → Discovery Engine → Decision Support (futuro)
    → Mission / Planner → Execution
```

**Nota RC2:** Discovery Engine V1 (ADR-006) está implementado como camada read-only (`executionInfluence: "none"`). Decision Support **não** está implementado.

Gates transversais: Confidence (ADR-005) · Privacy (ADR-007)

Identity, Memory e World Model fornecem contexto ao Cognitive Engine (somente leitura). Discovery consome Cognitive + World + Memory + Identity.

## Índice ADR

| ID | Título | Status |
|----|--------|--------|
| [ADR-001](./ADR-001-filosofia-aura-brain.md) | Filosofia do Aura Brain | Accepted |
| [ADR-002](./ADR-002-identity-engine.md) | Identity Engine | Accepted · **Implemented V1 (6.2)** |
| [ADR-003](./ADR-003-memory-engine.md) | Memory Engine | Accepted · **Implemented V1 (6.3)** |
| [ADR-003 Addendum](./ADR-003-addendum-sprint-6.3-architecture.md) | Fluxo Experience → Promotion | Accepted (6.3) |
| [ADR-004](./ADR-004-knowledge-graph.md) | Knowledge Graph | Accepted · **Implemented V1 as World Model (6.4)** |
| [ADR-004 Addendum](./ADR-004-addendum-world-model.md) | World Model vs Knowledge Graph | Accepted (6.4) |
| [ADR-005](./ADR-005-confidence-engine.md) | Confidence Engine | Accepted · parcial via Identity/Memory/World/Cognitive |
| [ADR-006](./ADR-006-discovery-engine.md) | Discovery Engine | Accepted (**RC2 implementado**) |
| [ADR-007](./ADR-007-privacy-ownership.md) | Privacy & Ownership | Accepted · aplicado Identity/Memory/World/Cognitive |
| [ADR-008](./ADR-008-cognitive-engine.md) | Cognitive Engine | Accepted · **Implemented V1 (6.5)** |
| ADR-009 | — | **Não existe** (Discovery permanece ADR-006) |

## RFCs

| ID | Título |
|----|--------|
| [RFC-001](./RFC-001-foundation-pipeline.md) | Pipeline fundacional |
| [RFC-002](../rfc/RFC-002-identity-engine-implementation.md) | Identity Engine Implementation |
| [RFC-003](../rfc/RFC-003-memory-engine-implementation.md) | Memory Engine Implementation |
| [RFC-004](../rfc/RFC-004-world-model-foundation.md) | World Model Foundation |
| [RFC-005](../rfc/RFC-005-cognitive-engine-foundation.md) | Cognitive Engine Foundation |

## Architecture v1.0

- [aura-brain-architecture-v1.md](../architecture/aura-brain-architecture-v1.md)
- [matrices.md](../architecture/matrices.md)
- [internal-api-v1.md](../architecture/internal-api-v1.md)
- [new-engine-checklist.md](../architecture/new-engine-checklist.md)

## Princípio desta pasta

Documentos aqui **decidem** o que construir e por quê.  
Código cita estes ADRs; mudanças de princípio exigem ADR novo.
