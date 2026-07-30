# ADR-003 Addendum — Memory Engine Architecture Update (Sprint 6.3)

| Campo | Valor |
|-------|-------|
| Status | Accepted |
| Sprint | 6.3 — Memory Engine V1 |
| Data | 2026-07-28 |
| Base | ADR-003 (histórico preservado) |
| Não altera | Princípios do ADR-003 original; apenas detalha fluxo de promoção |

---

## Atualização arquitetural

```
Experience Layer
    ↓
Memory Engine
    ↓
Memory Promotion Engine
    ↓
Identity Engine e futuro Knowledge Graph
```

## Regras (obrigatórias)

1. **Memory** é a fonte histórica de experiências, fatos, feedbacks e aprendizados.
2. **Identity** continua sendo a autoridade sobre claims confirmadas e corrigidas explicitamente pelo usuário.
3. Memory **nunca** sobrescreve uma claim confirmada, corrigida, rejeitada ou arquivada pelo usuário.
4. Memory pode **propor** novas claims ou **anexar evidências** a claims existentes.
5. Toda promoção para Identity passa por gates de confiança, privacidade e sensibilidade.
6. Uma pesquisa, visualização ou interação isolada **nunca** vira identidade, objetivo ou missão.
7. O futuro Knowledge Graph consumirá memórias promovidas, mas **não** é implementado nesta sprint.

## Separação de confiança

| Estágio | Campo | Significado |
|---------|-------|-------------|
| Memory | `confidence` | Quão sustentada está a memória |
| Promotion | `promotionConfidence` | Confiança da decisão de promoção |
| Identity | claim `confidence` | Confiança da claim (Authority do usuário) |

Não reutilizar um único valor entre estágios.

## Relação com Identity (Sprint 6.2)

- Integração apenas via contratos públicos (`createIdentityClaim`, `observeIdentityEvidence`).
- `sourceType: "memory_engine"` com referência estruturada à memória.
- `executionInfluence: "none"` permanece no Brain.

## Relação com Knowledge Graph / World Model

Candidatos `FUTURE_GRAPH_CANDIDATE` e memórias elegíveis são projetados no **World Model** (Sprint 6.4). Ver [ADR-004 Addendum](./ADR-004-addendum-world-model.md).
