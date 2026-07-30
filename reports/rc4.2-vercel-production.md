# RC4.2 — Vercel Deployment & External Testing

| Campo | Valor |
|-------|-------|
| Data | 2026-07-30 |
| Status | **READY** (código + docs + testes; deploy/migrations manuais) |
| Objetivo | Dois usuários testando Aura Brain em produção na Vercel |
| Fora de escopo | Novas features · Kernel Cognitivo · Sprint 7.3 · Planner · Execution · Automações · Agentes |

---

## 1. Resumo

RC4.2 prepara o projeto para **testes externos reais**: envs documentadas, go-live guide, checklist de migrations (sem auto-apply), páginas de erro padronizadas, logs mínimos seguros, recuperação de senha (gap de produção), e suíte `test:production`.

Nenhuma feature de produto nova além do necessário para auth/ops de produção.

---

## 2. Produção — validado no código

| Área | Status |
|------|--------|
| Build / Typecheck | Scripts prontos; executar no CI/local antes do deploy |
| Env | `docs/deployment/vercel-env.md` + `.env.example` |
| Rotas smoke | `PRODUCTION_ROUTE_SMOKE` |
| Middleware / proxy | `proxy.ts` → `lib/supabase/proxy.ts` |
| Auth | Login, signup, logout, recovery, update password, session refresh |
| Supabase | SSR cookies `secure` em produção |
| RLS | Policies SQL + mirrors em testes (visibility / workspace) |
| Uploads / OCR | Smart Capture (OCR depende de `OPENAI_API_KEY`) |
| Busca | Global search inclui Decision / Scenario / Priorities |
| Knowledge / Discovery / Projects | Rotas dashboard |
| Decision / Scenario / Prioritization | Centers + `executionInfluence: none` |

---

## 3. Environments

Obrigatórias:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (não-localhost em produção)

Ver `lib/production/env-checklist.ts`.

---

## 4. Auth

| Fluxo | Implementação |
|-------|----------------|
| Criar conta | `/cadastro` → `signUp` |
| Login | `/login` → `signInWithPassword` |
| Logout | `logout()` → `signOut` |
| Recuperação | `/recuperar-senha` → `resetPasswordForEmail` |
| Nova senha | `/redefinir-senha` → `updateUser({ password })` |
| Refresh | browser `autoRefreshToken: true` |

---

## 5. Workspace

Fluxos existentes mantidos: criar, convidar, aceitar em `/convite/[token]`, contexto personal/workspace, isolamento via RLS + `canAccess*`.

Página `/sem-permissao` para UX de 403.

---

## 6. Migrations

Checklist: `docs/deployment/migrations-checklist.md`  
**Nenhuma migration automática.**

Lista canônica: `BRAIN_MIGRATIONS_RC4_2`.

---

## 7. Erros

| Página | Arquivo |
|--------|---------|
| 404 | `app/not-found.tsx` |
| 500 | `app/error.tsx` |
| 500 root | `app/global-error.tsx` |
| Offline | `app/offline/page.tsx` |
| Sem permissão | `app/sem-permissao/page.tsx` |

Error boundaries usam `unstable_retry` (Next.js 16.2+).

---

## 8. Logs

`lib/production/logger.ts` — IDs mascarados, keys sensíveis → `[redacted]`.

---

## 9. Performance / responsividade

Documentado em go-live: SSR, lazy imports de fontes, cache in-memory, smoke desktop/tablet/mobile via Playwright existente.

---

## 10. Testes

```bash
npm run test:production
```

Cobertura: env, docs, auth redirects, workspace/RLS mirrors, Discovery routes, Knowledge/Projects, Decision, Scenario, Priorities, logger, proxy/vercel, migrations files.

---

## 11. Definition of Done

| Critério | Status |
|----------|--------|
| Projeto pronto para deploy | ✔ |
| Variáveis documentadas | ✔ |
| Checklist de produção | ✔ |
| Build / typecheck scripts | ✔ (executar antes do ship) |
| Deploy Vercel funcionando | ⏳ manual (ops) |
| Segundo usuário acessa | ⏳ manual (convite + RLS) |
| Nenhuma feature de produto nova | ✔ |
| Kernel Cognitivo intocado | ✔ |
| Sprint 7.3 não iniciada | ✔ |

---

## 12. Próximos passos operacionais (humanos)

1. Aplicar migrations pendentes no Supabase (checklist)
2. Setar envs na Vercel + Site URL no Supabase Auth
3. Deploy
4. Criar Usuário A e B; validar PRIVATE vs WORKSPACE
5. Smoke OCR/upload se `OPENAI_API_KEY` estiver setada

**Não iniciar Sprint 7.3 nesta entrega.**
