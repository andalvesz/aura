# Relatório — Business Expert B1.0 Foundation

**Data:** 2026-08-04  
**Status:** Complete (foundation)  
**Parar em:** B1.0 (sem pesquisa web, sem APIs externas)

## Objetivo

Entregar a primeira especialização oficial do Aura Brain como **Skill instalada sobre o Kernel**, sem duplicar Brain, Planner, Conversation, Learning, Agent Runtime ou Knowledge Hub.

## Entregáveis

### Módulo `lib/business-expert/`

| Arquivo | Função |
|---------|--------|
| `types.ts` | Contratos B1.0 |
| `registry.ts` | Domínios (10) + tipos de negócio (13) + ensure registered |
| `knowledge.ts` | Base embutida offline |
| `context.ts` | Context builder empresarial (anti-leak Identity) |
| `validators.ts` | Perfil, ventures, intents |
| `advisor.ts` | Conselhos por intenção |
| `planner.ts` | Draft → core Planner mapping |
| `service.ts` | Store perfil / objetivos / negócios |
| `business-engine.ts` | Run + overview + home card |
| `command-center.ts` | Handlers Command Center |
| `index.ts` | API pública |

### Capability & Skill

- **Capability:** `module.business-expert` — name *Business Expert*, category **Business Intelligence**, route `/dashboard/business-expert`, `defaultEnabled: true`
- **Skill:** `skill.business-expert` — category **Business Intelligence**, depende de planner, decision-support, learning, conversation

### UI & Home

- Página: `app/dashboard/business-expert/page.tsx`
- Client: abas Visão geral / Perfil / Áreas / Objetivos / Negócios / Conhecimento
- Home: `BusinessExpertHomeWidget` + link no header de atalhos

### Conversation

Intents reconhecidos e respondidos com orientação + CTA para Business Expert:

1. Quero abrir um negócio  
2. Quero empreender  
3. Quero ganhar dinheiro  
4. Quero validar uma ideia  
5. Quero criar uma empresa  

### Planner

`draftBusinessPlan` + `toCorePlanDraftProposal` (pipeline `business_expert_b1`, `sourceKind: manual`). Não cria engine paralelo.

### Learning

Adapter `business-expert` em `lib/learning/registry.ts` — sinais observáveis, sem apply silencioso.

## Definition of Done

| Critério | Status |
|----------|--------|
| Business Expert registrado | ✅ |
| Skill instalada (catalog + install pure) | ✅ |
| Capability instalada (catalog + install pure) | ✅ |
| UI criada | ✅ |
| Home integrada | ✅ |
| Conversation integrada | ✅ |
| Planner integrado (draft mapping) | ✅ |
| Learning integrado (adapter) | ✅ |
| Testes PASS | ✅ `npm run test:business-expert` (12/12) |
| Typecheck PASS | ✅ `npm run typecheck` |
| Build PASS | ✅ `npm run build` |

## Limitações conscientes B1.0

- Sem pesquisa web  
- Sem APIs externas  
- Store de perfil em memória (fundação; persistência Supabase fica para sprint futura)  
- Não é assessoria jurídica/contábil  

## Próximos passos (fora do B1.0)

- Persistência de perfil empresarial  
- Enriquecimento com Discovery/Decision Support  
- Pesquisa web opcional (B2.x)  
- Seed 1-click no Plan Center a partir da UI  

## Arquivos-chave

- `lib/business-expert/*`
- `lib/capabilities/catalog.ts` / `skills-catalog.ts`
- `lib/conversation/intent-router.ts` / `orchestrator.ts`
- `lib/learning/registry.ts` / `types.ts`
- `docs/business-expert/foundation.md`
- `utils/business-expert.test.ts`
