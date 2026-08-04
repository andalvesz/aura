# Business Expert B1.0 — Foundation

## Visão

Business Expert é a **primeira especialização oficial** do Aura Brain. Não é um segundo Brain, Planner, Conversation, Learning ou Agent Runtime. Opera como **Skill + Capability** instalada sobre o kernel existente.

## Escopo B1.0

Compreende (offline, sem web, sem APIs externas):

- negócios digitais e locais
- empreendedorismo e monetização
- validação, marketing, vendas, operações e crescimento

### Fora de escopo (B1.0)

- Pesquisa web
- Integrações externas
- Duplicação do Knowledge Hub
- Automações silenciosas

## Arquitetura

```
lib/business-expert/
  types.ts            # Contratos (perfil, domínio, intents)
  registry.ts         # Domínios + tipos de negócio + checagem de registro
  knowledge.ts        # Base embutida offline
  context.ts          # Contexto empresarial (sem Identity pessoal)
  validators.ts       # Validação e parse de intents
  advisor.ts          # Conselhos estruturados
  planner.ts          # Rascunhos → core Planner (não fork)
  service.ts          # Store em memória (perfil / objetivos / ventures)
  business-engine.ts  # Orquestração
  command-center.ts   # Intents do Command Center
  index.ts            # API pública
```

Integrações:

| Kernel | Como integra |
|--------|----------------|
| Capabilities | `module.business-expert` (categoria **Business Intelligence**) |
| Skills | `skill.business-expert` |
| Conversation | Intents “Quero abrir um negócio…” no Command Center |
| Planner | `toCorePlanDraftProposal` → `PlanDraftProposal` (`sourceKind: manual`) |
| Learning | Adapter `business-expert` (sinais, sem auto-apply) |
| Home | Card `BusinessExpertHomeWidget` |
| UI | `/dashboard/business-expert` |

## Domínios de conhecimento

Mercado · Modelos de negócio · Produto · Marketing · Vendas · Operação · Financeiro · Escala · Validação · Monetização

## Tipos de negócio suportados

Produto Digital · Afiliado · SaaS · Marketplace · Agência · Consultoria · Mentoria · Comunidade · Assinatura · Prestação de Serviço · Loja Física · E-commerce · Negócios Locais

## Perfil empresarial

**Separado do Identity Engine.**

Campos: experiência, capital, objetivos, áreas de interesse, habilidades, negócios atuais/passados, disponibilidade, equipe, preferências.

O context builder **rejeita** payloads com chaves de identity/pessoal.

## UI

Rota: `/dashboard/business-expert`

Abas: Visão geral · Perfil empresarial · Áreas · Objetivos · Negócios · Conhecimento

Home: card Business Expert no personal dashboard.

## Command Center

Responde a:

- “Quero abrir um negócio”
- “Quero empreender”
- “Quero ganhar dinheiro”
- “Quero validar uma ideia”
- “Quero criar uma empresa”

## Testes

```bash
npm run test:business-expert
```

## Versão

- Capability / Skill: `1.1.0` (B1.X Production Ready)
- Relatório: `reports/business-expert-production-ready.md`
- Foundation original: `reports/business-expert-b1.0.md`
