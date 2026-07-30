# UNRESOLVED tables — Multiusuário V1 (auditoria, sem mudança automática de escopo)

Data: 2026-07-28

## Resumo

Escopo **não alterado**. Tabelas permanecem em `UNRESOLVED_TABLES`.
Acesso direto à filha é filtrado via EXISTS na tabela pai (PERSONAL) ou SELECT global (SYSTEM catalog).

---

## 1. `ad_sets`

| Campo | Valor |
|-------|--------|
| Tabela pai | `ad_campaigns` (`campaign_id`) |
| Como é acessada | `lib/supabase/repositories/ad-sets.repository.ts` → Ads Commander |
| Policies | SELECT/INSERT/UPDATE/DELETE: `exists (select 1 from ad_campaigns c where c.id = campaign_id and c.user_id = auth.uid())` |
| Risco atual | Baixo para IDOR entre users: filha exige ownership do pai. Médio para multiuser: campanhas são PERSONAL — não há isolamento por Workspace. |
| Recomendação | **PERSONAL** (seguir `ad_campaigns.user_id`). Não promover a WORKSPACE sem produto. |
| Contorno direto? | Não — RLS na filha replica o check do pai. |

## 2. `ad_creatives`

| Campo | Valor |
|-------|--------|
| Tabela pai | `ad_campaigns` (`campaign_id`) |
| Como é acessada | `ad-creatives.repository.ts` |
| Policies | Idem `ad_sets` via `ad_campaigns.user_id` |
| Risco atual | Mesmo perfil de `ad_sets`. |
| Recomendação | **PERSONAL** |
| Contorno direto? | Não |

## 3. `funnel_steps`

| Campo | Valor |
|-------|--------|
| Tabela pai | `funnels` (`funnel_id`) |
| Como é acessada | `funnel-engine.repository.ts` |
| Policies | EXISTS em `funnels` com `f.user_id = auth.uid()` |
| Risco atual | Baixo IDOR user-to-user; sem workspace. |
| Recomendação | **PERSONAL** |
| Contorno direto? | Não |

## 4. `market_benchmarks`

| Campo | Valor |
|-------|--------|
| Tabela pai | Nenhuma (catálogo global) |
| Como é acessada | `market-leader.repository.ts` (SELECT) |
| Policies | `SELECT using (true)` — leitura aberta |
| Risco atual | Baixo se somente dados de referência seed; sem INSERT policy para authenticated → escrita bloqueada por default deny. |
| Recomendação | **SYSTEM** (catálogo compartilhado somente leitura) |
| Contorno direto? | N/A — intencionalmente global |

## 5. `specialists`

| Campo | Valor |
|-------|--------|
| Tabela pai | Nenhuma (catálogo global) |
| Como é acessada | `specialist-engine.repository.ts` |
| Policies | `SELECT to authenticated using (true)` |
| Risco atual | Baixo (seed/catalog). Sem policies de escrita para authenticated. |
| Recomendação | **SYSTEM** |
| Contorno direto? | N/A |

---

## Decisão

Manter `UNRESOLVED` no código até decisão de produto explícita.
Não aplicar migration de escopo nestas tabelas nesta sprint.
