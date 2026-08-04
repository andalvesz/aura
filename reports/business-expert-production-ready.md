# Business Expert B1.X — Production Ready

**Data:** 2026-08-04  
**Versão:** 1.1.0  
**Status:** Complete (parar ao B1.X)

## Objetivo

Tornar o Business Expert um consultor diário utilizável **sobre o Kernel**, sem Brain/Planner/Conversation/Learning/Agent/Discovery/Decision paralelos.

## Entregas principais

| Área | Status |
|------|--------|
| Knowledge expandido (20+ domínios) | ✅ |
| Digital + Local catalogs | ✅ |
| Marketplace registry (13) | ✅ |
| Marketing channels registry | ✅ |
| Business modes (8) | ✅ |
| Idea Validator | ✅ |
| Affiliate Assistant | ✅ |
| Product Builder | ✅ |
| Local Business Advisor | ✅ |
| Complete plan → core Planner | ✅ |
| Web research **provider** (sem crawler) | ✅ |
| Knowledge packs + ingest queue | ✅ |
| Discovery detector `business_expert_opportunity_v1` | ✅ |
| Recommendations / scenarios / comparisons | ✅ |
| Learning signals (sem silent apply) | ✅ |
| Command Center expanded | ✅ |
| Home widgets (oportunidades, negócios, mercados, ideias, projetos) | ✅ |
| UI `/dashboard/business-expert` tools | ✅ |

## Integrações kernel

- **Planner:** `toCorePlanDraftProposal` + checklist/milestones/KPIs  
- **Discovery:** detector registrado no registry existente  
- **Recommendation:** cards no Expert (alimentam UX/home)  
- **Decision:** `compareBusinessOptions` (Kiwify×Hotmart, afiliado×próprio, etc.)  
- **Scenario:** `draftBusinessScenario` (“E se…”)  
- **Learning:** eventos `intent:*` no adapter `business-expert`  
- **Conversation:** intents naturais + orchestrator  

## Testes

```bash
npm run test:business-expert
npm run test:business-advisor
npm run test:affiliate
npm run test:product-builder
npm run test:idea-validator
npm run test:marketplaces
npm run test:business-modes
```

## Docs

- `docs/business-expert/foundation.md`  
- `docs/business-expert/marketplaces.md`  
- `docs/business-expert/affiliate.md`  
- `docs/business-expert/product-builder.md`  
- `docs/business-expert/business-modes.md`  
- `docs/business-expert/knowledge-packs.md`  

## Verificação

| Check | Resultado |
|-------|-----------|
| test:business-expert | PASS (12) |
| test:business-advisor | PASS |
| test:affiliate | PASS |
| test:product-builder | PASS |
| test:idea-validator | PASS |
| test:marketplaces | PASS |
| test:business-modes | PASS |
| typecheck | PASS |
| build | PASS |

## Limitações conscientes

- Sem crawler embutido; web research exige provider Aura registrado.  
- Sem APIs externas de marketplace.  
- Jurídico/impostos = orientação.  
- Store em memória (persistência futura fora do B1.X).  
