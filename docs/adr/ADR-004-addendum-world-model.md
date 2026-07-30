# ADR-004 Addendum — World Model Foundation (Sprint 6.4)

| Campo | Valor |
|-------|-------|
| Status | Accepted |
| Sprint | 6.4 — World Model Foundation |
| Data | 2026-07-28 |
| Base | ADR-004 (histórico preservado) |
| Não altera | Princípios do ADR-004 original; clarifica produto vs infraestrutura |

---

## Decisões registradas

1. **Knowledge Graph** é o nome técnico da infraestrutura de nós/arestas.
2. **World Model** é o conceito de produto e arquitetura cognitiva do Aura Brain.
3. O World Model representa **entidades, relações, contexto, temporalidade, evidências e confiança**.
4. As **tabelas de domínio** continuam sendo fontes operacionais de verdade (missões, empresas, documentos, etc.).
5. O World Model é uma **projeção cognitiva e explicável** sobre dados de domínio, Memory e Identity.
6. **Entity First** não significa substituir toda tabela por uma entidade genérica (não é migração EAV).
7. Nenhuma projeção pode **alterar silenciosamente** os dados de origem.
8. Nenhuma relação **inferida** pode ser tratada como fato confirmado sem gates apropriados.
9. **Correções e rejeições humanas** prevalecem sobre projeções automáticas.
10. O World Model **não influencia execução** nesta sprint (`executionInfluence: "none"`).

## Pipeline oficial (atualizado)

```
Experience Layer
        ↓
Memory Engine
        ↓
Memory Promotion Engine
        ↓
World Model
        ↓
Identity / Discovery / Mission / Planner
        ↓
Execution
```

Identity também pode publicar claims confirmadas no World Model.  
Missões, empresas e documentos podem publicar projeções com ownership, origem estruturada e idempotência — sem duplicar autoridade.

## Separação de confiança

| Estágio | Campo | Significado |
|---------|-------|-------------|
| Source | source confidence | Confiança da fonte de domínio |
| Entity | entity confidence | Confiança da entidade projetada |
| Relationship | relationship confidence | Confiança da aresta |
| Projection | projection confidence | Confiança da decisão de projeção |
| Future | reasoning confidence | Reservado (não nesta sprint) |

## Matriz de autoridade

| Fonte | Autoridade operacional | World Model |
|-------|------------------------|-------------|
| Mission Engine | Edita missão | Projeta entidade/relações |
| Identity Engine | Claims confirmadas | Projeta person + skills/prefs |
| Memory Engine | Memórias tipadas | Projeta elegíveis via promotion |
| Business/Workspace | Cadastro estruturado | Projeta business/org |
| Documentos | Registro estruturado | Projeta document + DOCUMENTS |
| World Model UI | Correção de projeção/relação | Não edita fonte silenciosamente |

## Não-objetivos desta sprint

Discovery completo · Neo4j · embeddings · multi-hop complexo · execução por grafo · ontologia fechada rígida
