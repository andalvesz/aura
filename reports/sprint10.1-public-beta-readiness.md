# Sprint 10.1 — Public Beta & Production Readiness

**Status:** ✅ Fundação concluída  
**Data:** 2026-07-31  
**Dependência:** Sprint 10.0 SaaS & Skills Platform

---

## 1. Resumo executivo

A Sprint 10.1 transforma a foundation em memória da 10.0 em **persistência Supabase** (com fallback memory para testes), onboarding V2 retomável, beta access, Privacy Center, health, rate limits, observabilidade, termos preliminares e admin sem impersonação — **sem pagamentos e sem marketplace**.

## 2. Auditoria

| Componente | Persistente | Em memória | Produção | Correção |
|------------|-------------|------------|----------|----------|
| Capability installations | SQL 10.0 + service | testes | service supabase | wired |
| Skill installations | SQL 10.0 + service | testes | service supabase | wired |
| Feature flags | SQL + beta flags | testes | parcial | wired |
| Onboarding | `aura_onboarding_progress` | testes | wired | 10.1 |
| Nav prefs | `aura_navigation_prefs` | testes | wired | 10.1 |
| Branding / entitlements / usage | SQL 10.0 | testes | service parcial | follow-up |
| Beta access | `aura_beta_access` | store | RPC ensure | 10.1 |
| Invites / auth | já Supabase | — | ready | validado site URL |
| DB types platform | `types/platform-database.ts` | — | regen oficial pendente | documentado |

## 3. Persistência

- `lib/capabilities/services/platform.service.ts` — load/persist
- `AURA_PLATFORM_PERSISTENCE=memory|supabase` (`persistence-mode.ts`)
- Server actions: `app/actions/platform.ts`
- Testes unitários forçam memory

## 4. Migrations

- `20260731320000` (10.0) + `20260731330000` (10.1 corretiva)
- Ordem: `docs/operations/migration-order.md`
- **Não aplicar automaticamente em produção**

## 5. DB types

- Row types oficiais espelhando SQL: `types/platform-database.ts`
- Regeneração `supabase gen types` quando ambiente permitir
- Sem stubs inventados além do espelho de migration

## 6–8. Onboarding / presets / primeiro valor

- Onboarding V2 10 etapas + resume
- Presets com nav/widgets/templates
- Checklist pós-onboarding sem demo data

## 9–11. Workspace / convites / auth

- Convites existentes + `resolvePublicSiteUrl` (sem localhost em prod)
- Auth routes já presentes; mensagens de erro no `dashboard/error.tsx`

## 12–13. Home / navegação

- Home filtra widgets por capabilities
- `HomeWidgetBoundary` isola falhas
- Nav dinâmica + prefs persistidas

## 14–16. Flags / beta / admin

- `BETA_FEATURE_FLAGS`
- Estados INVITED/ACTIVE/SUSPENDED/REVOKED; legado ACTIVE
- Admin: health, beta agregado, usage — sem impersonação

## 17–20. Health / errors / obs / rate limit

- `buildPlatformHealth`
- `app/dashboard/error.tsx`
- Eventos padronizados em `observability.ts`
- Rate limits generosos por bucket

## 21–26. Storage / backup / export / deletion / privacy / termos

- `docs/operations/storage-risk.md`, `backup-recovery.md`
- Export conta + deletion REVIEW
- `/dashboard/settings/privacy`
- `/legal/*` preliminares

## 27–28. Responsividade / a11y

- Onboarding mobile-first (stack simples)
- Labels/botões; reduced-motion não forçado; críticos cobertos parcialmente

## 29–30. Performance / E2E

- Server actions + load sob demanda
- E2E completo 2 usuários depende de `.env.e2e` (template existente); suíte unitária `test:beta`

## 31–32. Segurança / testes

- RLS nas novas tabelas; cross-workspace Alvesz herdado da 10.0
- `npm run test:beta`

## 33. Limitações

- Persistência completa de branding/usage/entitlements no service ainda parcial (tabelas prontas)
- DB types oficiais não regenerados no CI sem projeto
- E2E autenticado end-to-end requer credenciais locais
- Hardcodes Anderson em APIs legadas (gap herdado)

## 34. Pendências → Sprint 10.2

- Regenerar `types/database.ts`
- Persistência total de todos os slices
- E2E Playwright 2 usuários green em CI
- Rate limit distribuído (Redis/edge)
- Revisão jurídica dos docs `/legal`

## Definition of Done

✔ Persistência capabilities/skills (supabase + memory tests)  
✔ Onboarding V2  
✔ Experience modes  
✔ Beta access + admin sem impersonação  
✔ Privacy / export / deletion request  
✔ Health + error boundary  
✔ Docs + relatório  
✔ `test:beta` / typecheck / build  
✔ Sem pagamentos / marketplace  

**Não iniciada Sprint 10.2.**
