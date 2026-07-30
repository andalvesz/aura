# ADR-004 — Knowledge Graph

| Campo | Valor |
|-------|-------|
| Status | Accepted |
| Sprint | 6.1 — Foundation ADRs |
| Data | 2026-07-28 |
| Depende de | ADR-001, ADR-002, ADR-003, ADR-007 |

---

## Problema

Missões, módulos e fatos da vida do usuário estão relacionados (meta financeira ↔ viagem ↔ calendário ↔ hábitos), mas o sistema ainda opera majoritariamente em silos e listas.

Sem um **Knowledge Graph** conceitual:

- dependências de missão não se conectam a entidades do mundo real do usuário;
- Discovery não “enxerga” pontes entre áreas;
- Planner não reutiliza relações já conhecidas;
- risco de recriar joins ad-hoc em cada feature.

## Contexto

- Mission Engine já modela dependências entre *tarefas* de uma missão.
- Intelligence mapeia DTOs por módulo.
- Expert Brain possui conhecimento de fontes — grafo de expertise, não da vida do usuário.
- Não há grafo unificado “User Life Graph”.

O Knowledge Graph do Aura Brain é sobre **a vida e os negócios do usuário**, não um grafo mundial aberto.

## Objetivos

1. Definir nós e arestas canônicos (conceituais).
2. Ligar missões, metas, recursos, pessoas, projetos e módulos.
3. Permitir consultas do tipo “o que bloqueia Disney?” ou “o que depende desta meta?”.
4. Manter o grafo como evidência estruturada, não como LLM hallucination store.
5. Evoluir sem exigir motor de grafo específico nesta sprint.

## Alternativas consideradas

### A — Continuar só com tabelas relacionais e joins

**Parcialmente necessária**, mas insuficiente como *modelo mental* e API de produto.

### B — Property graph dedicado desde o dia 1 (Neo4j etc.)

**Adiada:** decisão de storage é implementação futura; ADR fixa o *modelo*.

### C — Knowledge Graph lógico sobre entidades tipadas (escolhida)

Contrato de nós/arestas + materialização futura (SQL JSON, tabela de edges, ou engine de grafo) sem amarrar vendor agora.

### D — Tudo no LLM context window

**Rejeitada:** não escala, não audita, viola ADR-001.

## Decisão escolhida

Adotar o **Knowledge Graph (User Life Graph)** como camada de relações do Aura Brain.

### Tipos de nó (conceituais)

| Nó | Significado |
|----|-------------|
| `Self` | Referência à Identity do usuário |
| `Mission` | Missão |
| `Goal` | Objetivo/meta mensurável |
| `Milestone` / `Task` | Marcos e tarefas |
| `Resource` | Dinheiro, tempo, skill, documento |
| `Event` | Compromisso/calendário |
| `Habit` / `HealthSignal` | Hábitos e sinais de saúde |
| `Project` / `Opportunity` / `Hypothesis` | Camada negócios (rascunhos) |
| `ModuleRef` | Ponte para módulo do produto |
| `Constraint` | Restrição durável |
| `Insight` | Insight materializado (com validade) |

### Tipos de aresta (conceituais)

| Aresta | Significado |
|--------|-------------|
| `DEPENDS_ON` | Bloqueio / pré-requisito |
| `CONTRIBUTES_TO` | Tarefa/meta contribui à missão |
| `FUNDED_BY` | Recurso financeiro alimenta objetivo |
| `SCHEDULED_AS` | Ligação a evento |
| `CONSTRAINED_BY` | Limitado por restrição |
| `EVIDENCED_BY` | Fato suportado por memória/evento |
| `RELATED_MODULE` | Servido por módulo X |
| `DERIVED_FROM` | Insight/missão derivados de discovery |

### Regras

1. Toda aresta tem direção, motivo opcional e Confidence.
2. Grafo **não** substitui Mission Engine: missão continua agregando fases/tarefas; o grafo *liga* missão ao restante da vida.
3. Nós sensíveis herdam políticas ADR-007.
4. Expert Brain pode **apontar** (arestas de evidência externa) mas não sobrescreve fatos do usuário sem promoção.
5. Consultas do produto passam por facade (`queryGraph` conceitual), não por SQL espalhado.

## Consequências

**Positivas**

- Dependências multi-módulo explicáveis.
- Discovery e Planner com contexto relacional.
- UI futura de “mapa da missão” torna-se natural.

**Negativas**

- Complexidade de sincronizar grafo com módulos fonte.
- Risco de grafo desatualizado (stale edges).

## Estratégia de evolução

1. **Modelo** (agora).
2. **Projeção:** missões V1 → subgrafo Mission/Task/DEPENDS_ON.
3. **Bridge:** Goals, Events, Finance signals como nós leves.
4. **Enrichment:** Memory semântica → nós/arestas.
5. **Storage choice** em sprint de implementação (fora do 6.1).

> **Sprint 6.4:** implementação V1 como **World Model**. Ver [ADR-004 Addendum](./ADR-004-addendum-world-model.md), [RFC-004](../rfc/RFC-004-world-model-foundation.md) e [architecture/world-model.md](../architecture/world-model.md). Histórico deste ADR preservado.

## Compatibilidade futura

- Mission dependencies atuais mapeiam 1:1 para `DEPENDS_ON`.
- Intelligence DTOs podem ser *views* sobre o grafo, não o contrário no início.
- Não força migração imediata de todos os módulos.
- Business Lab drafts viram nós `Opportunity`/`Hypothesis` sem criar empresa.

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Over-modeling | Começar pelo subgrafo de missões |
| Edges órfãs | TTL / reconciliação com fontes |
| Performance de queries | Materializar views por missão ativa |
| Confundir com Expert Brain graph | Namespaces: User Life vs Expert Knowledge |

## Exemplos

**Missão Disney**

```
Mission:Disney
  ← CONTRIBUTES_TO — Goal:Economia Disney (R$15k)
  ← FUNDED_BY — Resource:Reserva viagem
  ← DEPENDS_ON chain — Task:Comprar passagem → Task:Economizar → Goal:Meta financeira
  — RELATED_MODULE → viagens, financeiro, calendario
  — CONSTRAINED_BY → Constraint:Não gastar reserva de emergência
```

**Negócios**

```
Mission:Abrir negócio X
  — DERIVED_FROM → Opportunity:… (draft)
  — EVIDENCED_BY → Hypothesis:… / Experiment:…
  (sem nó "CompanyRegistered" automático)
```

**Pergunta do Planner**

“O que bloqueia a missão Disney?” → percorre `DEPENDS_ON` abertos + riscos abertos + constraints.

## Relação com outros componentes

| Componente | Relação |
|------------|---------|
| ADR-002 | Nó `Self` |
| ADR-003 | `EVIDENCED_BY` Memory |
| ADR-005 | Confidence em nós/arestas |
| ADR-006 | Discovery cria candidatos a nós/arestas |
| ADR-007 | Visibilidade e delete em cascata conceitual |
| Mission Engine | Subgrafo principal V1 |
| Intelligence | Leitura de estado; grafo é mapa |
| Planner | Razão estrutural para planos |
| Execution | Não executa a partir do grafo sem Confidence + autonomia |
| RFC-001 | Terceira etapa do pipeline |
