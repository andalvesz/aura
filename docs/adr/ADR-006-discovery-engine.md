# ADR-006 — Discovery Engine

| Campo | Valor |
|-------|-------|
| Status | Accepted |
| Sprint | 6.1 — Foundation ADRs |
| Data | 2026-07-28 |
| Depende de | ADR-001, ADR-002, ADR-003, ADR-004, ADR-005, ADR-007 |

---

## Problema

O usuário não deveria precisar saber *qual módulo abrir* para progressar na vida. O sistema deve **descobrir**:

- missões emergentes (“você está economizando sem missão clara”);
- riscos e oportunidades;
- hipóteses de negócio;
- lacunas de conhecimento;

…sem inventar fatos e sem executar ações de risco.

Hoje Intelligence reage a regras sobre DTOs; Mission Engine planeja missões *já criadas*. Falta a camada que **propõe o que merece virar missão ou investigação**.

## Contexto

- Intelligence: prioridades/alertas/recomendações/insights (reativo a estado).
- Mission Engine: planejamento de missões existentes + templates.
- Business Lab (tipos): opportunity/hypothesis/experiment drafts.
- Expert Brain: conhecimento especializado ingerido.

Discovery é o motor **proativo e generativo-estruturado** (não chat), sentado entre Graph/Memory e Mission.

## Objetivos

1. Detectar candidatos a missão, oportunidade e experimento.
2. Explicar *por que* algo foi descoberto (evidências no Graph/Memory/Intelligence).
3. Respeitar Identity (afinidade) e Privacy (escopos).
4. Emitir apenas artefatos estruturados com Confidence.
5. Nunca criar empresa, cobrar pagamento ou executar HIGH/CRITICAL.

## Alternativas consideradas

### A — Expandir só as rules do Intelligence

**Insuficiente:** Intelligence é percepção do *agora*; Discovery é proposta de *direção*.

### B — LLM gera missões livremente

**Rejeitada como orquestrador:** viola ADR-001; permitido no máximo como auxiliar futuro rotulado e validado.

### C — Discovery Engine com catálogo de detectores + templates (escolhida)

Detectores determinísticos (e eventualmente híbridos) produzem `DiscoveryCandidate` tipados, ranqueados por Confidence e fit de Identity.

### D — Discovery = Mission templates browser

**Insuficiente:** catálogo estático não usa a vida real do usuário.

## Decisão escolhida

Criar o **Discovery Engine** como camada de descoberta estruturada.

### Saídas conceituais

| Artefato | Descrição |
|----------|-----------|
| `MissionCandidate` | Sugestão de nova missão (tipo, título, motivo, evidências) |
| `OpportunityCandidate` | Ideia de negócio/draft (nunca empresa) |
| `ExperimentCandidate` | Teste barato ligado a hipótese |
| `RiskCandidate` | Risco transversal além das rules atuais |
| `LearningCandidate` | Lacuna de skill/idioma/saúde |
| `LinkCandidate` | Nova aresta útil no Graph |

Cada candidato inclui: evidências, Confidence band, módulos envolvidos, risco se alguém tentar agir, e CTA seguro (criar rascunho / abrir missão / ignorar).

### Fontes de evidência (somente leitura)

1. Intelligence result (priorities/alerts/score)
2. Memory (semântica/feedback)
3. Knowledge Graph (lacunas e dependências)
4. Identity (afinidades e constraints)
5. Estado de missões ativas (evitar duplicar)

### Políticas

- Deduplicação forte contra missões ativas e candidatos recentes rejeitados (Feedback Memory).
- Respeito a `nao_sugerir_novamente`.
- BUSINESS candidates → só drafts (ADR-001).
- Candidatos com Confidence LOW → insight silencioso ou “explorar”, não push agressivo.
- Discovery **não** chama Execution; no máximo enfileira proposta no Planner como DRAFT.

### Facade futura

`getDiscovery({ identity, graph, memory, intelligence, missions })` — **sem implementação nesta sprint.**

## Consequências

**Positivas**

- Produto proativo sem ser invasivo.
- Ponte natural para Mission Engine.
- Business Lab ganha “entrada” limpa.

**Negativas**

- Risco de ruído (muitas sugestões) → quotas e ranking.
- Usuário pode sentir “o sistema me empurra” → tom Preference Profile + SUGGEST default.

## Estratégia de evolução

1. Formalizar candidatos e políticas (agora).
2. Portar patterns de Intelligence “recomendação forte” para candidatos de missão.
3. Ligar templates Mission Engine a `MissionCandidate`.
4. Adicionar detectores de negócio (Opportunity/Experiment) conservadores.
5. Só depois considerar assistência LLM *validada* por schemas.

## Compatibilidade futura

- Não substitui Intelligence; consome.
- Não substitui Mission Engine; alimenta.
- Expert Brain pode evidenciar Learning/Opportunity candidates via arestas, sem misturar ownership.
- UI: Meu Dia / Missões / Business Lab consomem a mesma facade.

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Alucinação de oportunidade | Evidências obrigatórias + Confidence |
| Duplicar missão existente | Deduper por tipo/título/graph |
| Pressão comercial indevida | Preferências + quiet hours + caps |
| Descoberta sensível (saúde) | ADR-007 classificação + consent |

## Exemplos

**Missão emergente**

Evidências: viagem marcada em 120 dias + sem missão TRAVEL + meta financeira ausente.  
→ `MissionCandidate` tipo TRAVEL, Confidence MEDIUM, CTA “Criar missão de viagem”.

**Aprendizado**

Streak de idioma quebrado 3 semanas + Identity afinidade LEARNING.  
→ `LearningCandidate` / missão LEARNING “Retomar inglês”.

**Negócios**

Usuário salvou várias pesquisas de mercado (Expert Brain) + missão BUSINESS vazia de hipóteses.  
→ `OpportunityCandidate` + `HypothesisCandidate` drafts — zero criação de empresa.

**Rejeição**

Usuário ignora “cortar delivery” duas vezes → Feedback Memory → Discovery não reemite por N dias.

## Relação com outros componentes

| Componente | Relação |
|------------|---------|
| ADR-002 | Fit e constraints |
| ADR-003 | Evidência e anti-spam |
| ADR-004 | Lacunas e links |
| ADR-005 | Ranking e gates |
| ADR-007 | Escopo e sensibilidade |
| Intelligence | Entrada reativa |
| Mission Engine | Destino de MissionCandidate |
| Planner | DRAFT plans a partir de candidatos |
| Business Lab | Opportunity/Experiment |
| RFC-001 | Quarta etapa do pipeline |
