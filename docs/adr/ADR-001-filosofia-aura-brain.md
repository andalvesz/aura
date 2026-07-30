# ADR-001 — Filosofia do Aura Brain

| Campo | Valor |
|-------|-------|
| Status | Accepted |
| Sprint | 6.1 — Foundation ADRs |
| Data | 2026-07-28 |
| Decisores | Aura Brain Core |

---

## Problema

O Aura Brain cresceu por módulos (financeiro, saúde, viagens, Expert Brain, Mission Engine, etc.). Sem uma filosofia explícita, cada sprint corre o risco de:

- tratar o produto como “conjunto de telas” em vez de sistema operacional cognitivo;
- misturar chat livre com resultados estruturados;
- automatizar ações de risco sem identidade, memória ou confiança;
- otimizar módulos isolados em vez de missões e vida do usuário.

## Contexto

Já existem (implementados em sprints anteriores):

- Intelligence Engine (prioridades, alertas, score)
- Aura Brain Core (planner, actions, automations, audit, autonomia)
- Mission Engine V1 (missões como eixo de organização)
- Meu Dia e dashboard context-aware
- Modelo de autonomia: SUGGEST → PREPARE → CONFIRM → AUTO_SAFE

Ainda **não** existem, como motores de primeira classe:

- Identity, Memory persistente tipada, Knowledge Graph, Confidence, Discovery

A filosofia deve unificar o que já existe com o que virá, sem invalidar V1.

## Objetivos

1. Definir o que o Aura Brain **é** e o que **não é**.
2. Estabelecer princípios invioláveis para todas as sprints futuras.
3. Alinhar produto (“sistema operacional para vida e negócios”) com arquitetura.
4. Garantir que missões, não módulos, sejam o eixo de organização da vida.
5. Manter saída estruturada como contrato primário (nunca só texto livre).

## Alternativas consideradas

### A — “Assistente conversacional com tools”

Chat-first; módulos como plugins do LLM.  
**Rejeitada:** frágil, difícil de auditar, contradiz DoD atual (sem OpenAI como orquestrador principal).

### B — “ERP pessoal modular”

Cada módulo independente; pouca inteligência cruzada.  
**Rejeitada:** usuário continua organizando por módulos; missões ficam secundárias.

### C — “Sistema operacional cognitivo orientado a missões” (escolhida)

Camadas de Identity → Memory → Knowledge → Discovery → Mission → Planner → Execution, com autonomia graduada e ownership do usuário.

### D — “Agente totalmente autônomo”

Executa tudo sozinho após onboarding.  
**Rejeitada:** incompatível com Privacy, Confidence e risco financeiro/externo.

## Decisão escolhida

O **Aura Brain** é o sistema operacional cognitivo do usuário para vida pessoal e negócios.

### Princípios invioláveis

1. **Missão > Módulo** — módulos servem missões; a UX tende a missões, Meu Dia e insights.
2. **Estrutura > Chat** — resultado primário é objeto tipado (prioridades, planos, missões, scores). Chat/explicação é opcional e secundário.
3. **Confiança antes de ação** — nenhuma execução de risco sem Confidence + autonomia adequada.
4. **Sugestão padrão** — o default é sugerir; AUTO_SAFE só para ações LOW reversíveis.
5. **Ownership do usuário** — dados, identidade e memória pertencem ao usuário (ADR-007).
6. **Nunca inventar fatos** — Discovery e Intelligence não fabricam saldos, eventos ou progresso.
7. **Business Lab sem criação automática de empresa** — hipóteses e experimentos, não CNPJ automático.
8. **Auditabilidade** — toda proposta/execução relevante deixa trilha.
9. **Evolução sem quebra silenciosa** — novos engines entram atrás de facades estáveis (`getMissionEngine`, `runAuraBrain`, futuros `getIdentity`, etc.).
10. **Expert Brain permanece distinto** — conhecimento especializado ingerido; não é sinônimo de Identity/Memory global.

### Identidade de produto

- Nome comercial: **Aura Brain**
- Subtítulo: “Seu sistema operacional para vida e negócios.”
- Não é: chatbot genérico, CRM isolado, nem autopilot irrestrito.

## Consequências

**Positivas**

- Critério claro para aceitar/recusar features.
- Missões e Meu Dia ganham legitimidade arquitetural.
- Facilita ADRs 002–007 e o RFC de pipeline.

**Negativas / trade-offs**

- Algumas UIs “por módulo” permanecerão por compatibilidade, mas deixam de ser o norte.
- Features “chat mágico que resolve tudo” serão deliberadamente limitadas.
- Exige disciplina: novos motores não podem bypassar Confidence/Privacy.

## Estratégia de evolução

1. **V1 (atual):** Intelligence + Brain Core + Mission Engine — alinhados à filosofia.
2. **V2 (pós-ADRs):** Identity + Memory + Graph + Confidence + Discovery como fundação.
3. **V3:** Discovery alimenta missões; Memory/Graph enriquecem planner; Execution permanece gated.
4. Revisar este ADR apenas se o posicionamento de produto mudar (decisão consciente, não drift).

## Compatibilidade futura

- Compatível com facades atuais (`runAuraBrain`, `getAuraIntelligence`, `getMissionEngine`).
- Não exige renomear Expert Brain, package name ou env vars.
- Não obriga remover módulos; obriga que novos fluxos “pensem em missão”.

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Filosofia ignorada em sprints urgentes | Checklist DoD cita ADR-001 |
| Pressão por autonomia total | ADR-005 + ADR-007 como gate |
| Duplicar “cérebros” (Expert vs Aura) | Fronteiras explícitas no RFC |
| Over-design antes de valor | ADRs agora; implementação só com RFC citado |

## Exemplos

**Alinhado**

- “Criar missão Disney → gerar fases/tarefas → sugerir economia → Meu Dia mostra avanço %.”
- “Prioridade CRITICAL financeira → notificação interna AUTO_SAFE → lançamento financeiro só com CONFIRM.”

**Não alinhado**

- “Bot responde em prosa e marca gasto como pago sem confirmação.”
- “Abrir empresa automaticamente a partir de uma ideia.”
- “Dashboard inventa saldo 0 quando não há dado.”

## Relação com outros componentes

| Componente | Relação |
|------------|---------|
| ADR-002 Identity | Quem o sistema está servindo |
| ADR-003 Memory | O que o sistema lembra sob a filosofia |
| ADR-004 Knowledge Graph | Como relacionar fatos sem virar chat |
| ADR-005 Confidence | Gate ético/operacional |
| ADR-006 Discovery | Como encontrar oportunidades sem inventar |
| ADR-007 Privacy | Ownership e limites |
| Mission Engine | Expressão principal da filosofia “missão > módulo” |
| Planner / Execution | Braço operacional sob autonomia |
| Intelligence | Percepção estruturada do estado atual |
| RFC-001 | Orquestra todos os princípios em pipeline |
