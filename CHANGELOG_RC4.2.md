# CHANGELOG — RC4.2 Vercel Deployment & External Testing

**Data:** 2026-07-30  
**Escopo:** Preparar Aura Brain para testes reais na Vercel por dois usuários.  
**Fora de escopo:** Novas features de produto · Kernel Cognitivo · Sprint 7.3 · Planner · Execution · Automações · Agentes

---

## Disponível para testes em produção

### Plataforma

- Deploy Next.js 16 na Vercel (`proxy.ts` + Supabase Auth SSR)
- Login / cadastro / logout
- Recuperação e redefinição de senha (`/recuperar-senha`, `/redefinir-senha`)
- Refresh de sessão (cookies PKCE, `autoRefreshToken` no browser)
- Workspaces: criar, convidar, aceitar (`/convite/[token]`), isolamento
- Páginas de sistema: 404, 500, offline (`/offline`), sem permissão (`/sem-permissao`)

### Aura Brain (atenção / análise — sem execução)

| Módulo | Rota |
|--------|------|
| Meu Dia / Home | `/dashboard` |
| Discovery | `/dashboard/discovery` |
| Knowledge Hub | `/dashboard/knowledge` |
| Projects / Business | `/dashboard/projects`, `/dashboard/business` |
| Decision Support | `/dashboard/decisions` |
| Scenario Engine | `/dashboard/scenarios` |
| Prioritization | `/dashboard/priorities` |
| Smart Capture / Attachments | FAB + `/dashboard/attachments` |
| Inbox / Favorites / Feed | `/dashboard/inbox`, `/favorites`, `/feed` |
| Busca global | shell do dashboard |

`executionInfluence` permanece **`none`** em Decision, Scenario e Priorities.

### Integrações (se envs configuradas)

- OCR / IA via `OPENAI_API_KEY`
- Google Calendar / Gmail / Drive (OAuth)
- Meta (opcional)
- Vercel Cron Expert Brain (`CRON_SECRET`)

---

## Documentação nova

- `docs/deployment/vercel-env.md`
- `docs/deployment/go-live.md`
- `docs/deployment/migrations-checklist.md`
- `reports/rc4.2-vercel-production.md`

---

## Testes

```bash
npm run test:production
npm run typecheck
npm run build
```

---

## Observações operacionais

- Migrations **manuais** — ver checklist
- Decision / Scenario / Priority: store in-memory no runtime; SQL prepara RLS/persistência
- Segundo usuário: convidar via UI de workspace; validar que PRIVATE não vaza
