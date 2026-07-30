# ADR-003 — Memory Engine

| Campo | Valor |
|-------|-------|
| Status | Accepted |
| Sprint | 6.1 — Foundation ADRs |
| Data | 2026-07-28 |
| Depende de | ADR-001, ADR-002, ADR-007 |

---

## Problema

O Aura Brain precisa “lembrar” sem virar:

- dump de logs ilegível;
- chat history como única memória;
- estado só em RAM de processo (como stores transitórios atuais);
- misture de preferências duráveis com “gastei R$40 no almoço”.

Sem Memory Engine, Mission/Planner/Discovery repetem perguntas, perdem contexto e não aprendem com feedback de forma disciplinada.

## Contexto

Hoje existem pedaços:

- `ai_memories` / memory services (legado e Expert Brain);
- learning/feedback no Aura Brain Core (sinais util/ignorado);
- mission-store e settings em memória de processo (best-effort);
- audit logs de ações.

Falta um **modelo unificado de memória** com tipos, retenção, promoção para Identity/Graph e políticas de privacidade.

## Objetivos

1. Definir tipos de memória (episódica, semântica, procedural, preferência).
2. Separar Memory de Identity e de Knowledge Graph.
3. Permitir escrita a partir de eventos, missões, feedback e (opcionalmente) conversas.
4. Definir promoção: Memory → Identity / Graph só com regras + Confidence.
5. Garantir esquecimento, expiração e exclusão sob ownership do usuário.

## Alternativas consideradas

### A — Chat log como memória única

**Rejeitada:** não estruturada; difícil de usar em Planner/Mission.

### B — Vector store only (RAG genérico)

**Rejeitada como única solução:** útil para recuperação, insuficiente para contratos tipados e audit.

### C — Memory Engine tipado + camadas de retenção (escolhida)

Tipos explícitos, escopos, TTL, links a entidades (missão, módulo), e índice opcional de recuperação semântica no futuro.

### D — Só audit log

**Rejeitada:** audit é compliance; memória é conhecimento acionável.

## Decisão escolhida

O **Memory Engine** é o sistema de recordação estruturada do Aura Brain.

### Tipos de memória

| Tipo | O que guarda | Exemplo | Retenção típica |
|------|--------------|---------|-----------------|
| **Episódica** | Eventos no tempo | “Concluiu marco Passagem em 2026-07-01” | Curta/média; pode sumarizar |
| **Semântica** | Fatos estáveis derivados | “Meta Disney = R$12k” | Média; promove a Graph/Identity |
| **Procedural** | Como o usuário age | “Prefere blocos de 25min” | Média; promove a Identity Preference |
| **Feedback** | Sinais explícitos | “Não sugerir de novo X” | Até revogar |
| **Working** | Contexto da sessão/dia | Estado do Meu Dia em curso | Muito curta |

### Princípios

1. Toda memória tem: dono (`userId`), escopo, fonte, timestamp, Confidence, e opcionalmente `missionId` / módulo.
2. Memory **não executa** ações; só informa.
3. Escrita automática só para fontes confiáveis (eventos do sistema, conclusões de tarefa, feedback explícito).
4. Conteúdo sensível (saúde, financeiro detalhado) exige classificação e políticas ADR-007.
5. Recuperação para Planner/Discovery deve preferir memórias de alta Confidence e relevância à missão ativa.

### Ciclo de vida

```
Evento / Feedback / Conclusão
    → Write Memory (tipada)
    → (opcional) Indexação para recall
    → Evaluate promotion rules
    → Identity e/ou Knowledge Graph
    → Expire / Summarize / Delete
```

### Facade futura

Algo na linha de `getMemory({ missionId?, kinds?, since? })` e `remember(entry)` — **sem implementação nesta sprint.**

## Consequências

**Positivas**

- Continuidade entre dias e missões.
- Base limpa para Graph e Discovery.
- Feedback deixa de ser buffer ad-hoc.

**Negativas**

- Custo de curadoria e sumarização.
- Risco de “memória errada” polarizar recomendações → exige Confidence e correção do usuário.

## Estratégia de evolução

1. Inventário do que já é memória de fato (feedback, ai_memories, audit).
2. Classificar em tipos deste ADR.
3. Introduzir Memory Engine atrás de facade; providers atuais viram adapters.
4. Promotion rules conservadoras (só semântica/procedural com Confidence alta).
5. Working memory alinhada ao Meu Dia (efêmera).

> **Sprint 6.3:** implementação V1 entregue. Ver [ADR-003 Addendum](./ADR-003-addendum-sprint-6.3-architecture.md), [RFC-003](../rfc/RFC-003-memory-engine-implementation.md) e [architecture/memory-engine.md](../architecture/memory-engine.md). O histórico deste ADR permanece; o addendum detalha Experience → Promotion → Identity.

## Compatibilidade futura

- Não obriga apagar `ai_memories` existentes; reclassifica conceitualmente.
- Mission Engine continua funcional sem Memory rica (degradação graciosa).
- Learning/feedback do Brain Core mapeia para tipo Feedback.
- Expert Brain knowledge ≠ Memory do usuário (fontes externas vs vida do usuário).

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Acúmulo infinito | TTL + sumarização + quotas |
| Contaminação Identity | Promotion gated por Confidence + review |
| Vazamento cross-workspace | Escopo obrigatório |
| Memory usada como verdade absoluta | Discovery/Planner tratam como evidência, não dogma |

## Exemplos

**Episódica**

Usuário conclui tarefa “Definir meta financeira” na missão Disney → memória episódica ligada à missão, usada no Meu Dia (“ontem você definiu a meta”).

**Semântica**

Após N confirmações, fato “Orçamento Disney = R$15.000” vira memória semântica e candidato a nó no Knowledge Graph.

**Feedback**

Usuário marca recomendação “cortar streaming” como `nao_sugerir_novamente` → Memory Feedback bloqueia Discovery/Planner de repetir.

**Working**

Durante o carregamento do Meu Dia, working memory segura missões ativas + top prioridades sem persistir como fato vitalício.

## Relação com outros componentes

| Componente | Relação |
|------------|---------|
| ADR-002 Identity | Destino de promoção de padrões estáveis |
| ADR-004 Knowledge Graph | Destino de fatos e relações |
| ADR-005 Confidence | Qualifica cada entry |
| ADR-006 Discovery | Lê memórias relevantes como evidência |
| ADR-007 Privacy | Delete/export/retenção |
| Mission Engine | Contexto e progresso narrável |
| Intelligence | Estado atual; Memory é histórico |
| Planner | Evita repetir planos rejeitados |
| Audit | Paralelo: compliance ≠ memory acionável |
| RFC-001 | Segunda etapa do pipeline |
