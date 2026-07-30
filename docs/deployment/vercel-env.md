# Variáveis de ambiente — Vercel + Supabase (RC4.2)

Documento canônico das variáveis para deploy em produção do Aura Brain.

Fonte de tipos: `lib/production/env-checklist.ts`  
Template local: `.env.example`

---

## 1. Obrigatórias (Production)

| Variável | Onde | Notas |
|----------|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | Anon **public** JWT (`eyJ…`). Nunca service role. |
| `NEXT_PUBLIC_SITE_URL` | Vercel + Supabase Auth | Ex.: `https://aura-ten-rose.vercel.app`. **Proibido localhost em produção.** |

Sem essas três, login, convites, recovery e redirects quebram.

---

## 2. Recomendadas / condicionais

| Variável | Quando | Notas |
|----------|--------|-------|
| `OPENAI_API_KEY` | OCR, Smart Capture, IA | Sem ela, OCR e rotas de IA degradam com erro amigável. |
| `PLATFORM_CREDENTIALS_KEY` | Integrações Meta/Kiwify etc. | 32 bytes hex ou base64. |
| `CRON_SECRET` | Vercel Cron Expert Brain | Bearer automático do Cron. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Calendar / Gmail / Drive | Redirect URIs = `{SITE}/api/.../callback` |
| `META_APP_ID` / `META_APP_SECRET` | Ads / Meta | Opcional |

---

## 3. Server-only (nunca `NEXT_PUBLIC_`)

| Variável | Uso |
|----------|-----|
| `SUPABASE_SERVICE_ROLE_KEY` | Scripts admin / audits. **Não** necessária ao runtime normal do app. |

---

## 4. Configuração no Vercel

1. Project → **Settings → Environment Variables**
2. Adicionar as obrigatórias para **Production** (e Preview se quiser)
3. Redeploy após alterar envs públicas (`NEXT_PUBLIC_*`)
4. Confirmar `NODE_ENV=production` no runtime (automático na Vercel)

---

## 5. Configuração no Supabase Auth

**Authentication → URL Configuration:**

- **Site URL:** igual a `NEXT_PUBLIC_SITE_URL` de produção
- **Redirect URLs:**
  - `https://<seu-dominio>/auth/callback`
  - `https://<seu-dominio>/auth/callback?next=/dashboard`
  - `https://<seu-dominio>/auth/callback?next=/redefinir-senha`
  - (Preview) URLs `*.vercel.app` se usar previews

**Providers → Email:** habilitado. Confirmação de email conforme política do time.

---

## 6. Checklist rápido

```bash
# Local
cp .env.example .env.local
# editar valores

npm run typecheck
npm run build
npm run test:production
```

Na Vercel: envs setadas → Deploy → abrir `/login` → criar conta / entrar.

---

## 7. Segurança

- Nunca logar anon key, service role, senhas ou tokens completos
- Logger de produção: `lib/production/logger.ts` (redação automática)
- Cookies Supabase: `secure` em produção (`lib/supabase/cookie-options.ts`)
