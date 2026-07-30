# ADR-005 — Confidence Engine

| Campo | Valor |
|-------|-------|
| Status | Accepted |
| Sprint | 6.1 — Foundation ADRs |
| Data | 2026-07-28 |
| Depende de | ADR-001, ADR-007 |

---

## Problema

O Aura Brain já distingue níveis de autonomia e risco de ação, mas **não** há um motor unificado que responda:

- Quão confiáveis são este fato, esta identidade, este insight ou esta recomendação?
- Podemos promover memória a Identity/Graph?
- Podemos executar, só preparar, ou apenas sugerir?

Sem Confidence Engine, automação e Discovery tendem a tratar todas as evidências como iguais — ou a bloquear tudo demais.

## Contexto

Já existe:

- `ActionRiskLevel`: LOW | MEDIUM | HIGH | CRITICAL
- Autonomia: SUGGEST | PREPARE | CONFIRM | AUTO_SAFE
- Scores de Intelligence e Mission (priority/risk/health…)
- Mission `confidence` em planos do Brain Core

Falta um **score de confiança epistêmica** (crença no dado/afirmação), distinto de:

- risco da ação;
- prioridade/urgência;
- saúde da missão.

## Objetivos

1. Separar **Confidence** (crença) de **Risk** (dano potencial) e **Priority** (urgência).
2. Definir dimensões e faixas para decisões de promoção e execução.
3. Gatear Discovery → Mission e Memory → Identity/Graph.
4. Explicar ao usuário (e ao audit) por que algo foi só sugerido.
5. Evitar falsa precisão (não fingir 97,3% sem base).

## Alternativas consideradas

### A — Usar só risk level de ações

**Insuficiente:** risco ≠ qualidade da evidência.

### B — Probabilidade bayesiana completa

**Adiada:** teoricamente forte; pesada demais para V2 fundacional.

### C — Confidence Engine ordinal + score 0–100 com dimensões (escolhida)

Score composto interpretável, faixas (LOW/MEDIUM/HIGH), regras de gate explícitas.

### D — Sempre pedir confirmação humana

**Seguro demais:** mata AUTO_SAFE legítimo e valor do produto.

## Decisão escolhida

Criar o **Confidence Engine** como gate transversal.

### Definição

**Confidence** = grau de crença justificada de que uma afirmação, dado, insight ou plano está correto e atual o bastante para o uso pretendido.

### Dimensões conceituais

| Dimensão | Pergunta |
|----------|----------|
| **Source trust** | A fonte é o próprio sistema, o usuário, inferência ou externo? |
| **Freshness** | Quão recente / ainda válido? |
| **Corroboration** | Há evidências independentes? |
| **Stability** | É padrão recorrente ou evento único? |
| **User affirmation** | O usuário confirmou/corrigiu? |
| **Scope fit** | Serve a este contexto/missão? |

Score overall 0–100 = combinação ponderada das dimensões (pesos definidos na implementação futura).  
Bandas: **LOW (0–39)** · **MEDIUM (40–69)** · **HIGH (70–100)**.

### Gates (política)

| Uso pretendido | Confidence mínima orientativa |
|----------------|-------------------------------|
| Mostrar insight informativo | LOW+ |
| Sugerir missão / ação | MEDIUM+ recomendado |
| Promover Memory → Identity/Graph | HIGH ou MEDIUM + afirmação do usuário |
| AUTO_SAFE execution | HIGH no *fato disparador* **e** risk LOW |
| CONFIRM / financeiro / externo | Qualquer confidence; execução só com confirmação |
| Criar empresa / pagamentos | Nunca automático (independente de confidence) |

### Separação explícita

```
Priority  → “fazer agora?”
Risk      → “quanto pode doer?”
Confidence→ “quão certo estamos?”
Autonomy  → “o sistema pode agir sozinho?”
```

Todos os quatro entram na decisão de Execution; nenhum sozinho basta.

### Facade futura

`assessConfidence(subject)` → score + band + reasons — **sem implementação nesta sprint.**

## Consequências

**Positivas**

- Linguagem comum entre Memory, Graph, Discovery e Execution.
- Menos automações “confiantes demais”.
- Melhor UX: “sugerimos porque…” / “não executamos porque confiança baixa”.

**Negativas**

- Mais um score na UI (precisa de pedagogia).
- Calibragem errada pode filtrar demais ou de menos.

## Estratégia de evolução

1. Formalizar gates neste ADR.
2. Anotar confidence em insights/recomendações Mission/Intelligence (campos conceituais).
3. Ligar feedback do usuário a User affirmation.
4. Calibrar pesos com auditorias (não com dark patterns).
5. Só então automatizar promoção Memory→Graph.

## Compatibilidade futura

- Não substitui Autonomy nem ActionRiskLevel — compõe.
- Planos atuais com `confidence: number` convergem para este modelo.
- Mission Score “confiança” alinha-se semanticamente a este engine.
- Degradação: se Confidence Engine indisponível, default = SUGGEST only.

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Falsa precisão | Bandas + reasons textuais estruturados |
| Confidence alta em dado errado | Freshness + user correction |
| Bypass por features novas | DoD cita gates deste ADR |
| Paralisia por LOW permanente | Caminhos de “pedir confirmação / dado” |

## Exemplos

**Alto confidence, baixo risco**

Hábito marcado concluído pelo usuário há 2 minutos → reminder de missão relacionado pode ser AUTO_SAFE.

**Baixo confidence, alto valor aparente**

Discovery sugere “abrir negócio de coaching” com poucas evidências → só insight/rascunho; nunca Execution de criação de empresa.

**Conflito**

Saldo financeiro desatualizado (freshness baixa) + alerta de orçamento → prioridade pode ser HIGH, mas Execution financeira permanece CONFIRM e confidence do saldo é LOW até refresh.

## Relação com outros componentes

| Componente | Relação |
|------------|---------|
| ADR-001 | Princípio “confiança antes de ação” |
| ADR-002/003/004 | Qualidade de promoção |
| ADR-006 | Filtra descobertas frágeis |
| ADR-007 | Dados sensíveis exigem confidence + consent para uso cruzado |
| Mission Engine | Score e recomendações |
| Intelligence | Insights com band |
| Planner | Escolhe propor vs executar |
| Automation | Só AUTO_SAFE com gate |
| Audit | Registra confidence da decisão |
| RFC-001 | Gate horizontal do pipeline |
