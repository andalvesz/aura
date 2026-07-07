# Digital Product Engine — Especificação Técnica (Sprint 1)

> **Status:** Especificação de arquitetura funcional — **sem implementação**.  
> **Objetivo:** Referência única para toda implementação futura do Digital Product Engine (DPE).  
> **Princípio:** Reutilizar engines existentes do Aura. Não criar novas engines neste sprint.

---

## 1. Missão do Engine

### Problema que resolve

Hoje o Aura possui módulos capazes de gerar produto, oferta, copy, landing, criativos e campanha — mas o processo está fragmentado entre Master Flow, dashboards isolados e certificações parciais. O criador precisa:

- Traduzir uma intenção vaga em oportunidade comercial validada
- Produzir um pacote digital completo com qualidade mensurável
- Saber objetivamente se o produto está **pronto para vender**
- Receber um **relatório único** com scores, pendências e próxima ação

O **Digital Product Engine** unifica esse pipeline em uma máquina de criação de produtos digitais: da intenção ao pacote comercial certificado, com aprendizado contínuo.

### Entrada

| Campo | Tipo | Obrigatório | Origem |
|-------|------|-------------|--------|
| `raw` | string | Sim | Texto livre do criador (ex.: *"Quero criar um negócio de emagrecimento para mulheres 40+"*) |
| `niche` | string | Não | Parser de intent (`utils/master-flow-intent.ts`) |
| `country` | string (ISO) | Não | Parser / default `BR` para pt-BR |
| `language` | string (BCP-47) | Não | Parser / locale resolver |
| `avatar` | string | Não | Parser (*"para ..."*) |
| `ticket` | number | Não | Parser ou input explícito |
| `user_id` | UUID | Sim | Contexto Supabase |
| `expert_brain_context` | knowledge | Não | Expert Brain (frameworks, playbooks) |

**Contrato de entrada canônico:** `MasterFlowIntentInput` → `resolveIntentV2()` em `utils/intent-engine-v2.ts`.

### Saída

| Artefato | Descrição |
|----------|-----------|
| **Pacote comercial** | Produto + oferta + funil + landing + copy + criativos + campanha preparada |
| **Registro de fluxo** | `master_flows` com `MasterFlowMetadata` acumulando IDs, URLs, scores e flags |
| **5 scores** | Opportunity, Profit, Mission, Quality, Ready To Sell |
| **Relatório DPE** | Documento único (seção 6) |
| **Status comercial** | `ready_to_sell` \| `ready_for_approval` \| `completed` \| `failed` |
| **Memória de aprendizado** | Resultados registrados no Growth Brain |

---

## 2. Fluxo completo

```
Objetivo (Intent)
       ↓
Opportunity Analysis
       ↓
Positioning
       ↓
Product Design
       ↓
Offer Design
       ↓
Sales Machine
       ↓
Marketing Assets
       ↓
Launch Plan
       ↓
Learning
       ↓
[Relatório DPE + Certificação Ready To Sell]
```

### Mapeamento para Master Flow existente

| Etapa DPE | Step(s) Master Flow | Gate humano |
|-----------|---------------------|-------------|
| Objetivo | Pré-step (intent metadata) | — |
| Opportunity Analysis | `market_hunter` | — |
| Positioning | `decision_engine` | — |
| Product Design | `product_factory` | — |
| Offer Design | `copylab` → `offer_engine` | — |
| Sales Machine | `funnel_engine` → `funnel_pages` → `checkout_engine` | — |
| Marketing Assets | `creative_director` | — |
| Launch Plan | `ads_commander` → `publish_orchestrator` | **Aprovação** em `publish_orchestrator` |
| Learning | Pós-conclusão (Growth Brain) | — |
| Certificação | `commercial_excellence` | — |

**Orquestrador:** `lib/supabase/services/master-flow.service.ts` (`startMission`, `runUntilBlocked`, `executeStep`).

**Contrato de estado:** `MasterFlowMetadata` em `utils/master-flow.ts` — registro único de artefatos, scores e pendências.

---

## 3. Definição de cada etapa

### 3.1 Objetivo (Intent)

| | |
|---|---|
| **Objetivo** | Capturar e normalizar a intenção comercial do criador em campos estruturados utilizáveis por todo o pipeline. |
| **Entradas** | Texto livre (`raw`), overrides opcionais de niche/country/language/avatar/ticket |
| **Saídas** | `MasterFlowIntent` + metadata inicial (`niche`, `country`, `language`, `avatar`, `ticket`, `user_intent`) |
| **Serviços reutilizados** | `utils/master-flow-intent.ts` — `parseIntentFromText`, `resolveMasterFlowIntent`; `utils/intent-engine-v2.ts` — `resolveIntentV2`, `intentConfidenceV2`, `sanitizeNicheV2` |
| **Critérios de qualidade** | Intent Confidence ≥ 60 para prosseguir sem warnings; ≥ 80 ideal. Campos mínimos: `niche` + `country` + `language`. Avatar ausente gera warning, não bloqueio. |

---

### 3.2 Opportunity Analysis

| | |
|---|---|
| **Objetivo** | Identificar e ranquear oportunidades de mercado alinhadas ao intent; selecionar a oportunidade #1 que guiará todo o pacote. |
| **Entradas** | `MasterFlowIntent`, candidatos de Growth Brain, Revenue AI, Kiwify, Operation Center |
| **Saídas** | `opportunity_name`, `niche`, `country`, `language` no metadata; `MarketOpportunity[]` persistidas; **Opportunity Score** da seleção |
| **Serviços reutilizados** | `utils/market-hunter.ts` — `analyzeMarket`, `computeOpportunityScore`, `rankProducts`, `computeMarketHunterDashboard`; `lib/supabase/services/market-hunter.service.ts`; `utils/master-flow-intent.ts` — `injectIntentCandidates`, `scopeMarketHunterDashboard` |
| **Critérios de qualidade** | Opportunity Score ≥ 70 para seguir sem alerta; ≥ 80 recomendado. Top oportunidade deve ter `nicheMatches` com intent. Watchlist criada para #1. |

---

### 3.3 Positioning

| | |
|---|---|
| **Objetivo** | Definir posicionamento estratégico: produto, mercado, idioma, oferta, criativo, landing e campanha ótimos com base em inteligência consolidada. |
| **Entradas** | Dashboards: Growth Brain, Revenue AI, Market Hunter, Operation Center, Performance AI, Kiwify, Meta; intent; Expert Brain patterns |
| **Saídas** | `decision_score`, `decision_reason`, seleções por dimensão (`bestProduct`, `bestCountry`, `bestLanguage`, etc.) em metadata |
| **Serviços reutilizados** | `utils/aura-decision-engine.ts` — `computeUnifiedDecisions`, `selectBestProduct`, `buildDecisionExecution`; `lib/supabase/services/aura-decision-engine.service.ts`; Expert Brain — `enrichDecisionsWithExpertPatterns` |
| **Critérios de qualidade** | `decision_score` ≥ 75; `confidence` ≥ 0.65; ao menos 3 fontes de inteligência consultadas. Razão de decisão registrada em linguagem natural. |

**Nota:** Positioning não é engine nova — é a camada de síntese do Decision Engine aplicada ao intent + oportunidade selecionada.

---

### 3.4 Product Design

| | |
|---|---|
| **Objetivo** | Gerar produto digital completo (conteúdo, estrutura, design, compliance) pronto para empacotamento comercial. |
| **Entradas** | Intake: niche, avatar, promessa, product_type, locale; Expert Brain (`product_creation`); positioning metadata |
| **Saídas** | `ProductFactory` record, `creator_products` vinculado, `factory_id`, `product_id`; **Product Quality Score** |
| **Serviços reutilizados** | `utils/product-factory-pro.ts` — `computeProductQualityScore`, `generateProductFactory`; `lib/supabase/services/product-factory.service.ts`; Expert Brain — `buildTransversalGenerationContext`, `augmentGeneratorSystemPrompt`; preflight knowledge (`mission-core` — `MISSION_KNOWLEDGE_STEPS`) |
| **Critérios de qualidade** | Score ≥ **85** (`PRODUCT_QUALITY_MIN_SCORE`); ≥ 20 páginas; ≥ 5.000 palavras; ≥ 5 FAQs; compliance ≠ `fail`. Auto-improve até 3 ciclos se abaixo do gate. |

**Dimensões do Product Quality Score (pesos):**

| Dimensão | Peso |
|----------|------|
| profundidade | 20% |
| valor_percebido | 18% |
| transformacao | 16% |
| completude | 18% |
| pages | 10% |
| compliance | 10% |
| faqScore | 8% |

---

### 3.5 Offer Design

| | |
|---|---|
| **Objetivo** | Estruturar stack de ofertas (front-end, bumps, upsells, downsells) com pricing, take rates e AOV projetado. |
| **Entradas** | `product_id`, `factory_id`, `copylab_id` (quando disponível), ticket, country, currency, sinais do Decision Engine e Growth Brain |
| **Saídas** | `OfferStackBundle`: offers[], metrics (AOV, ticket médio), recommendations; `offer_id` (front-end) no metadata; inputs para **Profit Score** |
| **Serviços reutilizados** | `utils/offer-engine.ts` — `generateOfferStack`, `resolveOfferStackStrategy`, `selectBestOfferStructure`; `lib/supabase/services/offer-engine.service.ts`; CopyLab (copy de vendas alimenta oferta); Expert Brain (`offer_creation`) |
| **Critérios de qualidade** | Front-end offer com título + preço > 0; stack com ≥ 2 camadas (front + bump ou upsell); AOV projetado > front price; take rates dentro dos defaults (`DEFAULT_TAKE_RATES`). Avaliado na Commercial Excellence dimensão `oferta`. |

**Sequência:** CopyLab executa antes (`copylab` step) para alimentar narrativa da oferta.

---

### 3.6 Sales Machine

| | |
|---|---|
| **Objetivo** | Construir máquina de vendas: funil multi-página, landings renderizadas, checkout conectado e CTA apontando para pagamento. |
| **Entradas** | `product_id`, `copylab_id`, `factory_id`, `offer_id`, credenciais de checkout (Kiwify/Stripe/Hotmart) |
| **Saídas** | `funnel_id`, `landing_id`, `landing_url`, `funnel_url`, `checkout_url`, `checkout_id`; **Landing Quality Score**; flags `checkout_pending`, `landing_published` |
| **Serviços reutilizados** | **Funnel Engine:** `lib/supabase/services/funnel-engine.service.ts` — `generateFunnel`; **Funnel Pages:** `utils/funnel-pages.ts`, `lib/supabase/services/funnel-pages.service.ts` — `generateFunnelPages`; **Landing Factory:** `utils/landing-factory.ts`, `utils/landing-benchmark.ts` — `computeLandingQualityScore`; **Checkout Engine:** `lib/supabase/services/checkout-engine.service.ts`, `utils/revenue-certification.ts` — `evaluateCheckoutCompletion` |
| **Critérios de qualidade** | Landing score ≥ **85** (`LANDING_EXCELLENCE_MIN`); checkout URL válida (https/http); CTA da landing aponta para checkout; funil com páginas na ordem `FUNNEL_PUBLISH_ORDER`: front_end → order_bump → upsell_1 → upsell_2 → downsell → thank_you. |

**Dimensões Landing Quality Score:**

| Dimensão | Referência |
|----------|------------|
| headline | ≥ 12 chars, subheadline, hero copy |
| oferta | offer JSON completo |
| cta | texto + link |
| prova | proof JSON |
| escassez | elementos de urgência |
| estrutura | benefits, FAQ, seções |

Benchmark styles: hormozi, finch, brunson, clickfunnels (pesos em `LANDING_BENCHMARK_STYLES`).

---

### 3.7 Marketing Assets

| | |
|---|---|
| **Objetivo** | Produzir copy multicanal e criativos visuais/scriptados para tráfego pago e orgânico. |
| **Entradas** | `operation_id`, copylab context, produto, oferta, avatar, Expert Brain (`copywriting`, `creative_strategy`) |
| **Saídas** | **CopyLab:** headline, VSL structure, emails, WhatsApp, posts, ads copy; **Creative Director:** imagens, carrosséis, scripts UGC/reel/VSL, variações headline/CTA; `copylab_id`, `creative_asset_id`, `CreativeGeneratedAsset[]`; **Creative Quality Score** |
| **Serviços reutilizados** | **CopyLab:** `utils/copylab.ts`, `lib/supabase/services/copylab.service.ts` — `generateCopylab`; **Creative Director:** `utils/creative-director.ts` — `computeCreativeQualityScore`, `computeHeuristicCreativeScore`; `lib/supabase/services/creative-director.service.ts` — `generateCreativePackage` |
| **Critérios de qualidade** | Copy: ≥ 80 chars no corpo principal; criativos: score ≥ **85** (`CREATIVE_EXCELLENCE_MIN`); ≥ 1 asset gerado real entregue (`isCreativeGeneratedAssetDelivered`); pacote inclui image + script ou carousel. Max 3 ciclos de regeneração. |

**Dimensões Creative Quality Score:** ctr_previsto, clareza, emocao, contraste, legibilidade, oferta → `overall`.

---

### 3.8 Launch Plan

| | |
|---|---|
| **Objetivo** | Preparar campanha de lançamento (Meta-first) com ad sets, criativos, budget, audiências e análise de risco — **sem publicar automaticamente**. |
| **Entradas** | `operation_id`, landing URL, copy, criativos, budget sugerido, Meta Intelligence |
| **Saídas** | `AdCampaign` + ad sets + ad creatives; `campaign_id`; budget/audience suggestions; risk analysis; status `pending_approval`; **Campaign Quality Score**; plano de lançamento textual no relatório DPE |
| **Serviços reutilizados** | **Ads Commander:** `utils/ads-commander.ts` — `computeCampaignQualityScore`, `prepareFullCampaign`; `lib/supabase/services/ads-commander.service.ts`; **Publish Orchestrator (gate):** `utils/publish-orchestrator.ts`, `lib/supabase/services/publish-orchestrator.service.ts` — `orchestratePublish` (bloqueado até aprovação explícita) |
| **Critérios de qualidade** | Campaign score ≥ **85** (`CAMPAIGN_EXCELLENCE_MIN`); ≥ 1 ad set + ≥ 1 creative; landing URL real vinculada; `ADS_COMMANDER_SAFE_MODE` ativo — publicação exige `explicit_publish_approval`. |

**Gate de aprovação:** `MISSION_APPROVAL_GATE_STEP = publish_orchestrator` (`utils/mission-core.ts`). Missão pausa antes de publicar funil e campanha.

**Dimensões Campaign Quality Score:** ctr_previsto, cpc_previsto, relevancia, consistencia, audience, creative.

---

### 3.9 Learning

| | |
|---|---|
| **Objetivo** | Registrar resultados (estimados ou reais) do ciclo e alimentar padrões vencedores para próximas criações. |
| **Entradas** | IDs de artefatos do ciclo, métricas pós-lançamento (CTR, ROAS, conversão, receita, spend), lições aprendidas |
| **Saídas** | `GrowthBrainMemory` entries; patterns sincronizados; insights e recommendations no dashboard |
| **Serviços reutilizados** | `utils/growth-brain.ts` — `registerCampaignResult`, `registerCreativeResult`, `registerLandingResult`, `registerCopyResult`, `computeMemoryScore`, `syncGrowthPatternsFromMemories`; `lib/supabase/services/growth-brain.service.ts` |
| **Critérios de qualidade** | Memória com `metricType: "real"` pontua 100%; `"estimated"` pontua 30% (`computeMemoryScore`). Ao menos 1 memória registrada por ciclo concluído. Patterns derivados alimentam Market Hunter e Decision Engine no ciclo seguinte. |

---

## 4. Definição dos Scores

Todos os scores são **0–100**, arredondados em 2 casas decimais quando aplicável.  
Gate global de excelência comercial: **≥ 85** (`READY_TO_SELL_EXCELLENCE_MIN`).

### 4.1 Opportunity Score

**Propósito:** Medir atratividade de mercado da oportunidade selecionada.

**Fonte:** `computeOpportunityScore()` em `utils/market-hunter.ts`.

**Fórmula:**

```
demandScore      = clamp(estimatedDemand, 0, 100) × 0.35
competitionScore = (100 - clamp(estimatedCompetition, 0, 100)) × 0.25
conversionScore  = clamp(estimatedConversion, 0, 1) × 100 × 0.25
platformBonus    = kiwify: 8 | operation_center: 7 | revenue_ai: 6 | growth_brain: 5 | default: 3

Opportunity Score = demandScore + competitionScore + conversionScore + platformBonus
```

**Persistência:** `market_opportunities.opportunity_score` + `MasterFlowMetadata` (via oportunidade selecionada).

**Interpretação:**

| Faixa | Significado |
|-------|-------------|
| ≥ 80 | Oportunidade forte — prosseguir |
| 70–79 | Viável com ressalvas |
| < 70 | Revisar nicho/mercado antes de investir em produção |

---

### 4.2 Profit Score

**Propósito:** Estimar potencial de lucro do pacote comercial montado (não confundir com lucro real pós-venda).

**Fonte (composição sobre serviços existentes):**

| Componente | Origem | Peso |
|------------|--------|------|
| AOV vs ticket mínimo | `OfferStackMetrics.expectedAov` | 25% |
| Margem estimada | Revenue AI forecast / Kiwify commission signals | 20% |
| Conversion potential | `estimatedConversion` do Market Hunter | 20% |
| Stack depth | Nº de ofertas no stack (front + bumps + upsells) | 15% |
| Recurrence signal | Continuity/VIP offer presente | 10% |
| Growth Brain ROAS histórico do nicho | `GrowthBrainDashboard.avgRoas` | 10% |

**Fórmula:**

```
aovScore = min(100, (expectedAov / benchmarkAov[nicho]) × 100)
         // benchmarkAov default: ticket × 1.8 se nicho desconhecido

marginScore = clamp(predictedMarginPct, 0, 100)
            // Revenue AI predicted_profit / predicted_revenue × 100; fallback: 40 se ausente

conversionScore = clamp(estimatedConversion × 100 × 4, 0, 100)
                // 2.5% conversion → 100

stackScore = min(100, (totalOffers / 5) × 100)

recurrenceScore = hasContinuityOffer ? 100 : hasVipOffer ? 70 : 40

roasScore = avgRoas != null ? min(100, avgRoas × 25) : 50  // ROAS 4.0 → 100

Profit Score = aovScore×0.25 + marginScore×0.20 + conversionScore×0.20
             + stackScore×0.15 + recurrenceScore×0.10 + roasScore×0.10
```

**Persistência proposta:** `MasterFlowMetadata.profit_score` (campo futuro).

**Interpretação:**

| Faixa | Significado |
|-------|-------------|
| ≥ 80 | Alto potencial de monetização |
| 65–79 | Viável — otimizar stack ou pricing |
| < 65 | Revisar oferta antes de escalar tráfego |

---

### 4.3 Mission Score

**Propósito:** Medir completude e saúde do ciclo de criação em tempo real (progresso + qualidade + pendências).

**Fonte (composição):**

| Componente | Origem | Peso |
|------------|--------|------|
| Progresso do pipeline | `flow.progress` (0–100) | 20% |
| Artefatos gerados | `countMissionAssetsReady()` / 6 | 25% |
| Intent confidence | `intentConfidenceV2()` | 10% |
| Decision quality | `decision_score` | 10% |
| Pendências resolvidas | 100 − (pendências × 15), min 0 | 15% |
| Publication checklist | % itens done | 20% |

**Fórmula:**

```
progressScore   = flow.progress
artifactsScore  = (assetsReady / 6) × 100
intentScore     = intentConfidenceV2(intent)
decisionScore   = metadata.decision_score ?? 0
pendenciesScore = max(0, 100 - count(pendencies) × 15)
checklistScore  = (checklistDone / checklistTotal) × 100

Mission Score = progressScore×0.20 + artifactsScore×0.25 + intentScore×0.10
              + decisionScore×0.10 + pendenciesScore×0.15 + checklistScore×0.20
```

**Serviços reutilizados:** `utils/mission-core.ts` — `buildMissionStatus`, `buildMissionPendencies`, `buildPublicationChecklist`, `countMissionAssetsReady`; `utils/intent-engine-v2.ts` — `intentConfidenceV2`.

**Persistência proposta:** `MasterFlowMetadata.mission_score` (campo futuro).

**Interpretação:**

| Faixa | Significado |
|-------|-------------|
| ≥ 85 | Missão madura — pronta para revisão final |
| 60–84 | Em construção — continuar pipeline |
| < 60 | Início ou bloqueada — ação necessária |

---

### 4.4 Quality Score

**Propósito:** Score agregado de excelência comercial de todos os ativos do pacote.

**Fonte:** `computeCommercialExcellenceResult()` em `utils/commercial-excellence.ts`.

**Fórmula:**

```
Por dimensão d ∈ {produto, oferta, landing, criativo, funil, campanha}:
  dimensionScore[d] = média dos qualityScore | excellenceScore | finalScore dos assets da dimensão

Quality Score = média aritmética de todas as dimensionScores disponíveis
```

**Scores por dimensão (fontes existentes):**

| Dimensão | Função de score |
|----------|-----------------|
| produto | `computeProductQualityScore()` |
| landing | `computeLandingQualityScore()` |
| criativo | `computeCreativeQualityScore()` |
| campanha | `computeCampaignQualityScore()` |
| oferta, funil | Aura Excellence (`quality_scores` table) |

**Gate:** `deliverable = Quality Score ≥ 85` (`isCommercialExcellenceDeliverable`).

**Persistência:** `commercial_excellence_score` / `excellence_score` em metadata.

---

### 4.5 Ready To Sell Score

**Propósito:** Score binário-composto — **100 somente se todos os gates passarem**; caso contrário, penalização proporcional aos gaps.

**Fonte:** `evaluateReadyToSellCertification()` em `utils/revenue-certification.ts` + `certifyReadyToSell()` em `lib/supabase/services/revenue-certification.service.ts`.

**Fórmula:**

```
gates = [
  checkout_url válida,
  funnel_url presente,
  landing_url presente,
  landing_published === true,
  campaign_id presente,
  campaign_prepared === true,
  excellence_score ≥ 85,
  product_quality_score ≥ 85,
  landing_quality_score ≥ 85,
  campaign_quality_score ≥ 85,
  creative_asset_delivered === true,
  landing CTA → checkout_url,
  explicit_publish_approval === true
]

gatesPassed = count(gates where true)
Ready To Sell Score = (gatesPassed / gates.length) × 100

ready = gatesPassed === gates.length  // binário — ver seção 5
commercial_status = ready ? "ready_to_sell" : "incomplete"
```

**Status de fluxo:** `applyReadyToSellCertification()` → `ready_to_sell` | `ready_for_approval` | `completed`.

---

## 5. READY TO SELL — Checklist obrigatório

**Regra absoluta:** Nenhum produto pode ser marcado `ready_to_sell` se **qualquer** item abaixo falhar.  
**Implementação de referência:** `evaluateReadyToSellCertification()` + `canMarkReadyToSell()` em `utils/mission-core.ts`.

### Checklist comercial (13 gates)

| # | Item | Validação | Serviço |
|---|------|-----------|---------|
| 1 | Checkout conectado | `validateCheckoutUrl(checkout_url)` | Checkout Engine |
| 2 | Funil URL | `funnel_url` non-empty | Funnel Publish |
| 3 | Landing URL | `landing_url` non-empty | Landing Factory |
| 4 | Landing publicada | `landing_published === true` | Publish Orchestrator |
| 5 | Campanha criada | `campaign_id` presente | Ads Commander |
| 6 | Campanha preparada | ad sets + creatives ready | Ads Commander |
| 7 | Produto score ≥ 85 | `product_quality_score ≥ 85` | Product Factory Pro |
| 8 | Landing score ≥ 85 | `landing_quality_score ≥ 85` | Landing Benchmark |
| 9 | Campanha score ≥ 85 | `campaign_quality_score ≥ 85` | Ads Commander |
| 10 | Criativo entregue | asset gerado real no Storage | Creative Director |
| 11 | CTA → checkout | checkout URL no HTML da landing | Revenue Certification |
| 12 | Excelência ≥ 85 | `excellence_score ≥ 85` | Commercial Excellence |
| 13 | Aprovação explícita | `explicit_publish_approval === true` | Publish Orchestrator |

### Checklist de checkout (sub-gates)

Via `evaluateCheckoutCompletion()`:

- [ ] Checkout criado
- [ ] URL válida e salva
- [ ] URL injetada no funil/landing
- [ ] CTA da landing aponta para checkout

### Status resultantes

| Condição | Status |
|----------|--------|
| Todos os 13 gates passam | `ready_to_sell` |
| Falta apenas aprovação | `ready_for_approval` |
| Qualquer outro gap | `completed` (incomplete) + `certification_gaps[]` |
| Erro no pipeline | `failed` |

### Pendências de UI (Mission Core)

Exibidas enquanto incompleto (`utils/mission-core.ts` — `buildMissionPendencies`):

- `Checkout não conectado`
- `Landing ainda não publicada`
- `Campanha preparada, aguardando aprovação`

---

## 6. Relatório final (DPE Report)

O Aura deve entregar **um único relatório** ao final do ciclo (ou ao atingir gate de revisão).  
**Formato proposto:** JSON estruturado + renderização UI (Mission Result Panel evoluído).

### Estrutura `DigitalProductReport`

```typescript
type DigitalProductReport = {
  // Metadados
  report_id: string;
  flow_id: string;
  generated_at: string;          // ISO 8601
  opportunity_name: string;
  commercial_status: "ready_to_sell" | "ready_for_approval" | "completed" | "failed";

  // 1. Resumo Executivo
  executive_summary: {
    intent: string;              // raw original
    niche: string;
    avatar: string | null;
    country: string;
    language: string;
    one_liner: string;           // frase de posicionamento
    verdict: string;             // "Pronto para vender" | "Revisão necessária" | "Incompleto"
  };

  // 2. Scores
  scores: {
    opportunity: number;
    profit: number;
    mission: number;
    quality: number;
    ready_to_sell: number;
  };

  // 3. Produto
  product: {
    id: string;
    name: string;
    type: string;
    quality_score: number;
    pages: number;
    issues: string[];
  };

  // 4. Oferta
  offer: {
    id: string;
    front_price: number;
    currency: string;
    expected_aov: number;
    stack_layers: number;
    recommendations: string[];
  };

  // 5. Landing
  landing: {
    id: string;
    url: string | null;
    published: boolean;
    quality_score: number;
    headline: string | null;
  };

  // 6. Copy
  copy: {
    id: string;
    headline: string | null;
    channels: string[];          // email, whatsapp, instagram, facebook, google
    body_length: number;
  };

  // 7. Criativos
  creatives: {
    asset_id: string | null;
    generated_count: number;
    quality_score: number;
    types: string[];             // image, carousel, ugc_script, etc.
  };

  // 8. Plano de lançamento
  launch_plan: {
    campaign_id: string | null;
    platform: string;
    status: string;
    budget_suggestion: { daily_min: number; daily_max: number; currency: string } | null;
    audience_suggestions: string[];
    risk_level: number | null;
    campaign_quality_score: number;
  };

  // 9. Checklist
  checklist: Array<{
    id: string;
    label: string;
    done: boolean;
    category: "artifact" | "quality" | "publish" | "checkout";
  }>;

  // 10. Pendências
  pendencies: string[];

  // 11. Próxima ação recomendada
  next_action: {
    label: string;               // texto para o criador
    priority: "critical" | "high" | "medium";
    step: string | null;         // Master Flow step se aplicável
    cta: string;                 // "Continuar missão" | "Conectar checkout" | "Aprovar publicação"
  };

  // Aprendizado (quando disponível)
  learning: {
    patterns_applied: string[];
    growth_memories_created: number;
  } | null;
};
```

### Fontes de dados do relatório

| Seção | Builder existente |
|-------|-------------------|
| Scores | `buildMissionStatus`, `certifyReadyToSell`, fórmulas seção 4 |
| Checklist | `buildPublicationChecklist()` + gates RTS |
| Pendências | `buildMissionPendencies()` |
| Próxima ação | `computeMissionNextAction()` |
| Artefatos | `buildMissionArtifacts()` |

---

## 7. Mapeamento de reutilização

**Regra:** O DPE **não cria engines novas**. Orquestra e certifica engines existentes via Master Flow + Mission Core + Revenue Certification.

### 7.1 Matriz Engine → Etapa DPE

| Engine existente | Etapa(s) DPE | Papel |
|------------------|--------------|-------|
| **Master Flow** | Todas | Orquestração, metadata, status, progress |
| **Market Hunter** | Opportunity Analysis | Scoring e ranking de oportunidades |
| **Decision Engine** | Positioning | Síntese estratégica multi-fonte |
| **Product Factory** | Product Design | Geração + quality score do produto |
| **CopyLab** | Offer Design, Marketing Assets | Copy multicanal |
| **Offer Engine** | Offer Design | Stack de ofertas + AOV |
| **Funnel Engine** | Sales Machine | Estrutura do funil |
| **Funnel Pages** | Sales Machine | Páginas + landings por step |
| **Landing Factory** | Sales Machine | HTML, benchmark, publish |
| **Checkout Engine** | Sales Machine | Pagamento + injeção CTA |
| **Creative Director** | Marketing Assets | Criativos + quality score |
| **Ads Commander** | Launch Plan | Campanha preparada (safe mode) |
| **Publish Orchestrator** | Launch Plan | Gate de publicação + approval |
| **Commercial Excellence** | Certificação | Quality Score agregado |
| **Revenue Certification** | Certificação | Ready To Sell Score + status |
| **Growth Brain** | Learning | Memória + patterns |
| **Expert Brain** | Todas (transversal) | RAG, frameworks, preflight warnings |

### 7.2 Matriz de dependências

```
Expert Brain ─────────────────────────────┐
                                          ▼
Intent ──► Market Hunter ──► Decision Engine ──► Product Factory
                                                      │
                      CopyLab ◄───────────────────────┤
                         │                            │
                         ▼                            ▼
                   Offer Engine              Funnel Engine
                         │                            │
                         └──────────┬─────────────────┘
                                    ▼
                            Funnel Pages / Landing
                                    │
                                    ▼
                            Checkout Engine
                                    │
                                    ▼
                          Creative Director
                                    │
                                    ▼
                            Ads Commander
                                    │
                                    ▼
                         Publish Orchestrator (gate)
                                    │
                                    ▼
                        Commercial Excellence
                                    │
                                    ▼
                        Revenue Certification
                                    │
                                    ▼
                              Growth Brain
```

### 7.3 Contratos reutilizados (não duplicar)

| Contrato | Arquivo | Uso no DPE |
|----------|---------|------------|
| `MasterFlowIntent` | `utils/master-flow-intent.ts` | Entrada canônica |
| `MasterFlowMetadata` | `utils/master-flow.ts` | Estado acumulado do ciclo |
| `MissionStatus` | `utils/mission-core.ts` | Status runtime + pendências |
| `ReadyToSellCertification` | `utils/revenue-certification.ts` | Gate final |
| `CommercialExcellenceResult` | `utils/commercial-excellence.ts` | Quality Score |
| `MarketHunterDashboard` | `utils/market-hunter.ts` | Opportunity Analysis |
| `UnifiedDecisionEngineResult` | `utils/aura-decision-engine.ts` | Positioning |
| `OfferStackBundle` | `utils/offer-engine.ts` | Offer Design + Profit Score |
| `GrowthBrainDashboard` | `utils/growth-brain.ts` | Learning loop |

### 7.4 O que NÃO fazer na implementação futura

- Criar `DigitalProductEngineService` paralelo ao Master Flow — **estender** Master Flow / Mission Core
- Duplicar quality scores — **compor** scores existentes
- Bypass de aprovação (`PUBLISH_ORCHESTRATOR_MASTER_FLOW.bypassExplicitApproval` permanece `false`)
- Marcar `ready_to_sell` sem checklist completo (seção 5)
- Publicar campanha/funil automaticamente no modo missão

### 7.5 Evolução prevista (Sprint 2+)

| Item | Sprint futuro |
|------|---------------|
| `profit_score` / `mission_score` em metadata | Sprint 2 |
| `DigitalProductReport` builder + API | Sprint 2 |
| UI unificada DPE Report | Sprint 3 |
| Learning automático pós-publicação | Sprint 3 |
| Positioning como módulo UI dedicado | Sprint 4 |

---

## Apêndice A — Arquivos de referência

| Área | Path principal |
|------|----------------|
| Orquestração | `lib/supabase/services/master-flow.service.ts` |
| Mission runtime | `utils/mission-core.ts`, `hooks/use-mission-core.ts` |
| Intent | `utils/master-flow-intent.ts`, `utils/intent-engine-v2.ts` |
| Market | `utils/market-hunter.ts` |
| Decisão | `utils/aura-decision-engine.ts` |
| Produto | `utils/product-factory-pro.ts` |
| Oferta | `utils/offer-engine.ts` |
| Copy | `utils/copylab.ts` |
| Landing | `utils/landing-benchmark.ts`, `utils/landing-factory.ts` |
| Funil | `utils/funnel-pages.ts` |
| Criativos | `utils/creative-director.ts` |
| Campanha | `utils/ads-commander.ts` |
| Publicação | `utils/publish-orchestrator.ts` |
| Excelência | `utils/commercial-excellence.ts` |
| Certificação | `utils/revenue-certification.ts` |
| Aprendizado | `utils/growth-brain.ts` |
| Conhecimento | `lib/supabase/services/expert-brain.service.ts` |

---

## Apêndice B — Glossário

| Termo | Definição |
|-------|-----------|
| **DPE** | Digital Product Engine — especificação deste documento |
| **Pacote comercial** | Conjunto produto + oferta + funil + landing + copy + criativos + campanha |
| **Gate** | Condição binária obrigatória para Ready To Sell |
| **Safe mode** | Modo onde geração ocorre mas publicação exige aprovação humana |
| **Intent** | Intenção estruturada derivada do objetivo textual do criador |
| **Artefato** | Entidade persistida (product, offer, landing, copy, creative, campaign) |

---

*Documento gerado como parte do AURA Sprint 1 — Digital Product Engine. Versão 1.0.*
