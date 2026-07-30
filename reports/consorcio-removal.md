# Remoção de Consórcios

**Data:** 2026-07-28  
**Sprint:** 4 — Aura Brain Core

## Decisão

Remover o **módulo legado Consórcios** (`public.leads` + UI) da experiência ativa, **sem DROP** destrutivo de tabelas/migrations históricas.

## Removido da experiência ativa

| Item | Ação |
|------|------|
| `components/dashboard/modules/consorcios-view.tsx` | **DELETE** |
| Workspace dashboard `listLeads()` (consorcios.service) | Removido — CRM usa clientes Alvesz |
| Quick action modal `AddLeadModal` / `useLeads` | Removido |
| Workspace quick action “Novo lead” | Agora link para `/dashboard/crescimento` |
| Menu | Já estava ausente |

## Mantido (legítimo / não é o módulo)

| Item | Classificação |
|------|---------------|
| Growth vertical `"consorcios"` | MANUAL_REVIEW — taxonomia Crescimento |
| Instagram marca `"consorcios"` | MANUAL_REVIEW |
| Finance origem `"consorcios"` | MANUAL_REVIEW |
| Business Lab niche `consorcio` | MANUAL_REVIEW — mercado genérico |
| `LEGACY_NOTIFICATION_HREFS.consorcios` → crescimento | KEEP_LEGACY |
| Rota `/dashboard/consorcios` redirect | Mantida (bookmarks) |
| Migrations históricas criando `public.leads` | KEEP_LEGACY — **nunca apagar** |
| `consorcios.service.ts` / `utils/consorcios.ts` / `hooks/use-leads.ts` | Ainda referenciados por BI/Social em alguns pontos — **onda 2** (desacoplar depois) |

## Tabelas / dados

| Tabela | Status |
|--------|--------|
| `public.leads` | **Arquivada na app** — sem DROP |
| FKs `communication_logs.lead_id` | Intactas |
| RLS | Intactas |

### Relatório de segurança de DROP

- **DROP agora?** Não.
- Motivo: possíveis dados históricos + FKs de comunicação + seeds.
- Preferência: revogar acesso app → migrar leads úteis para `growth_leads` (futuro) → DROP só com auditoria de contagem.

## Não afetado

- Growth leads (`growth_leads`)
- Clientes Alvesz
- Business Lab opportunities
- Contatos gerais / comms (exceto leitura ativa de `leads` no dashboard)

## Testes

- Unit: `consorcios view module removed from filesystem` PASS
- Playwright: rota consorcios redireciona PASS
