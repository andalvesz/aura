# Production URL Audit — Aura Brain

**Data:** 2026-07-31  
**Objetivo:** Garantir que **nenhuma** URL pública em produção use `localhost` / `127.0.0.1` silenciosamente.

---

## 1. Resumo

Antes desta auditoria, vários módulos OAuth e helpers (`gmail`, `google-drive`, `google-calendar`, `meta`, `comms`, `landing-factory`, callbacks) usavam:

```ts
process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
```

Isso gerava links quebrados para usuários quando `NEXT_PUBLIC_SITE_URL` faltava ou era ignorado.

**Correção:** todo runtime de URL pública passa por `lib/site-url.ts` (`resolvePublicSiteUrl` / `getPublicSiteUrl` / `resolveSiteUrlFromRequest` / `absolutePublicUrl`). Em produção, sem URL pública válida → `PublicSiteUrlError` (nunca localhost).

---

## 2. Matriz de auditoria

| Área | Antes | Depois |
|------|-------|--------|
| Auth callback | `resolvePublicSiteUrl` ✓ | ✓ reforçado |
| Convite workspace | `buildPublicInviteUrl` ✓ | ✓ |
| Convite beta | replace `/convite/` | `buildBetaInviteUrl` |
| Reset password | `getPasswordRecoveryRedirectUrl` ✓ | ✓ |
| Email confirmation | `getAuthCallbackUrl` ✓ | ✓ |
| Gmail OAuth | **localhost fallback** | `getPublicSiteUrl()` |
| Google Calendar OAuth | **localhost fallback** | `getPublicSiteUrl()` |
| Google Drive OAuth | **localhost fallback** | `getPublicSiteUrl()` |
| Meta OAuth | **localhost fallback** | `getPublicSiteUrl()` |
| Tracking pixel (comms) | **localhost fallback** | `getPublicSiteUrl()` |
| Landing Factory URLs | **localhost fallback** | `getPublicSiteUrl()` |
| metadataBase / OG | ausente / relativo | `metadataBase` + openGraph |
| PWA manifest | paths relativos ✓ | sem host absoluto (ok) |
| Playwright / E2E | localhost só local | intencional |
| Testes unitários | localhost para assert | intencional |

---

## 3. Locais corrigidos (arquivos alterados)

1. `lib/site-url.ts` — aliases `SITE_URL` / `APP_URL` / `VERCEL_URL`; helpers `absolutePublicUrl`, `resolveSiteUrlFromRequest`, `buildBetaInviteUrl`, `assertPublicRedirectUri`
2. `lib/gmail/config.ts`
3. `lib/google-drive/config.ts`
4. `lib/google-calendar/config.ts`
5. `lib/meta/config.ts`
6. `utils/comms.ts`
7. `utils/landing-factory.ts`
8. `lib/beta-ops/invites.ts`
9. `app/api/gmail/callback/route.ts` + `connect/route.ts`
10. `app/api/google-calendar/callback/route.ts` + `connect/route.ts`
11. `app/api/google-drive/callback/route.ts` + `auth/route.ts`
12. `app/api/knowledge-sources/google/callback/route.ts` + `connect/route.ts`
13. `app/api/meta/callback/route.ts` + `login/route.ts`
14. `app/layout.tsx` — `metadataBase` + Open Graph
15. `lib/production/env-checklist.ts` — warnings ampliados
16. `utils/site-url.test.ts` / `utils/production-url-audit.test.ts`
17. `package.json` — script `test:site-url`

**Único localhost restante em runtime:** fallback **dev-only** dentro de `lib/site-url.ts` quando `NODE_ENV !== "production"`.

---

## 4. Variáveis necessárias na Vercel

| Variável | Obrigatória | Valor exemplo |
|----------|-------------|---------------|
| `NEXT_PUBLIC_SITE_URL` | **Sim** | `https://aura-ten-rose.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | anon JWT |
| `VERCEL_URL` | Automática | host do deploy (fallback https) |
| `SITE_URL` / `APP_URL` | Opcional | aliases server-side |
| `GOOGLE_REDIRECT_URI` | Opcional se site URL ok | ver callbacks |
| `GMAIL_REDIRECT_URI` | Opcional | |
| `GOOGLE_DRIVE_REDIRECT_URI` | Opcional | |
| `GOOGLE_DRIVE_EXPERT_REDIRECT_URI` | Opcional | |
| `META_REDIRECT_URI` | Opcional | |

**Proibido em Production:** qualquer valor com `localhost` / `127.0.0.1` nessas URLs.

`NEXTAUTH_URL` — **não usado** neste projeto (auth via Supabase).

---

## 5. Variáveis / config no Supabase

**Authentication → URL Configuration**

- **Site URL:** `https://aura-ten-rose.vercel.app`
- **Redirect URLs (allow list):**
  - `https://aura-ten-rose.vercel.app/auth/callback`
  - `https://aura-ten-rose.vercel.app/auth/callback?next=/dashboard`
  - `https://aura-ten-rose.vercel.app/auth/callback?next=/redefinir-senha`
  - (opcional preview) `https://*-<team>.vercel.app/auth/callback`

Não definir Site URL como `http://localhost:3000` no projeto de produção.

---

## 6. URLs canônicas (produção)

Base: `https://aura-ten-rose.vercel.app`

| Uso | URL |
|-----|-----|
| Callback auth | `{BASE}/auth/callback` |
| Confirmação e-mail | `{BASE}/auth/callback` (emailRedirectTo) |
| Redefinição de senha | `{BASE}/auth/callback?next=/redefinir-senha` |
| Convite workspace | `{BASE}/convite/{token}` |
| Convite beta | `{BASE}/beta/invite/{token}` |
| Google Calendar callback | `{BASE}/api/google-calendar/callback` |
| Gmail callback | `{BASE}/api/gmail/callback` |
| Drive (knowledge) | `{BASE}/api/knowledge-sources/google/callback` |
| Drive (expert) | `{BASE}/api/google-drive/callback` |
| Meta callback | `{BASE}/api/meta/callback` |
| Tracking pixel | `{BASE}/api/comms/track/{token}` |
| Landing pública | `{BASE}/l/{slug}` |

---

## 7. Ordem de resolução (`resolvePublicSiteUrl`)

1. `NEXT_PUBLIC_SITE_URL` (não-localhost em prod)
2. `SITE_URL`
3. `APP_URL`
4. `VERCEL_URL` → `https://{host}`
5. Headers / `requestOrigin`
6. **Dev only:** `http://localhost:3000`
7. **Prod:** throw `PublicSiteUrlError`

---

## 8. Testes executados

```bash
npm run test:site-url
npm run test:beta-ops   # regressão invites
```

Cobertura: scan de fallbacks localhost em `app/lib/utils/hooks/components`, VERCEL_URL, throw em prod, OAuth URIs, auth/recovery/invite helpers.

---

## 9. Checklist pós-deploy

1. Vercel: `NEXT_PUBLIC_SITE_URL=https://aura-ten-rose.vercel.app` (Production)
2. Redeploy após alterar `NEXT_PUBLIC_*`
3. Supabase Auth Site URL + Redirect URLs alinhados
4. Google Cloud / Meta: redirect URIs = URLs da tabela §6
5. Enviar e-mail de recovery de teste → link **não** deve conter localhost
6. Criar convite workspace / beta → link com host Vercel

---

## 10. Conclusão

Todas as URLs públicas de runtime passam pelo helper único. Em produção **não existe** fallback silencioso para localhost. Se a URL pública não puder ser resolvida, o sistema falha de forma explícita.
