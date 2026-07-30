# Go-Live — Aura Brain na Vercel (RC4.2)

Guia operacional para publicar e validar com **dois usuários reais**.

Não aplica migrations automaticamente. Não inicia Sprint 7.3 / Planner / Execution.

---

## 1. Pré-requisitos

- Conta Vercel + projeto GitHub conectado
- Projeto Supabase com Auth Email
- `npm run typecheck` e `npm run build` PASS localmente
- Variáveis documentadas em [`vercel-env.md`](./vercel-env.md)

---

## 2. Como publicar

1. Push da branch estável para GitHub
2. Vercel → Import / Redeploy (framework **Next.js**)
3. Definir envs de Production (obrigatórias)
4. Deploy
5. Atualizar Supabase **Site URL** + **Redirect URLs** com o domínio Vercel
6. Abrir `https://<dominio>/login`

`proxy.ts` (Next.js 16) protege `/dashboard*` e renova sessão Supabase.

---

## 3. Como aplicar migrations

**Nenhuma migration automática no deploy.**

Checklist Brain / RC4.x / Sprint 7.x (aplicar na ordem, staging primeiro):

Ver lista canônica em `lib/production/env-checklist.ts` → `BRAIN_MIGRATIONS_RC4_2`.

### Procedimento

1. Backup do projeto Supabase
2. Revisar SQL em `supabase/migrations/<arquivo>.sql`
3. Aplicar via SQL Editor **ou**:

```bash
npx supabase db push --dry-run
# após revisão humana:
npx supabase db push
```

4. Confirmar RLS habilitado nas tabelas `aura_*`
5. Confirmar `execution_influence = 'none'` nas checks Decision / Scenario / Priority

### Migrations Brain críticas (pendentes se ainda não aplicadas)

| Arquivo | Escopo |
|---------|--------|
| `…_multiuser_workspaces_v1.sql` | Workspaces / convites |
| `…_multiuser_rls_hardening_v1.sql` | RLS |
| `…_identity` → `…_cognitive` | Kernel layers |
| `…_discovery_engine_v1.sql` | Discovery |
| `…_rc2_1_collaborative_go_live.sql` | Colaboração |
| `…_rc3_daily_operations.sql` | Daily ops |
| `…_rc3_1_smart_capture.sql` | Uploads / OCR fila |
| `…_rc4_projects_business_os.sql` | Projects |
| `…_rc4_1_knowledge_hub.sql` | Knowledge |
| `…_sprint7_decision_support.sql` | Decision |
| `…_sprint7_1_scenario_engine.sql` | Scenario |
| `…_sprint7_2_prioritization.sql` | Priorities |

> Engines Decision / Scenario / Priority ainda usam **store in-memory** no runtime; as migrations preparam persistência + RLS.

---

## 4. Como configurar variáveis

Ver [`vercel-env.md`](./vercel-env.md).

Mínimo Production:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=https://aura-ten-rose.vercel.app
```

Opcional para OCR/IA: `OPENAI_API_KEY`.

---

## 5. Como convidar um segundo usuário

1. Usuário A cria conta em `/cadastro` e entra
2. Cria / seleciona workspace (UI de workspace)
3. Convida e-mail do Usuário B (sem hardcode no código)
4. Usuário B recebe link `/convite/[token]` (origem = `NEXT_PUBLIC_SITE_URL`)
5. Usuário B aceita convite (conta existente ou cadastro)
6. Ambos acessam o mesmo workspace; dados `PRIVATE` não vazam

Página de falha de acesso: `/sem-permissao`.

---

## 6. Como validar o funcionamento

### Auth

| Fluxo | Rota | Esperado |
|-------|------|----------|
| Cadastro | `/cadastro` | Conta criada / confirm-email |
| Login | `/login` | Redirect `/dashboard` |
| Logout | ação logout | `/login` |
| Recuperação | `/recuperar-senha` | Email com link |
| Nova senha | `/redefinir-senha` | Após link do email |
| Refresh sessão | cookies PKCE | Dashboard permanece autenticado |

### Produto (smoke)

| Área | Rota |
|------|------|
| Discovery | `/dashboard/discovery` |
| Knowledge | `/dashboard/knowledge` |
| Projects | `/dashboard/projects` |
| Decision | `/dashboard/decisions` |
| Scenario | `/dashboard/scenarios` |
| Priorities | `/dashboard/priorities` |
| Uploads / sync | `/dashboard/attachments`, `/dashboard/settings/sync` |
| Busca | Global search no shell |

### RLS (manual com 2 usuários)

1. A cria memória/discovery **PRIVATE**
2. B no mesmo workspace **não** vê PRIVATE
3. A compartilha `WORKSPACE` → B vê
4. B em outro workspace **não** vê dados do workspace A
5. Removido do workspace perde acesso

### Erros padronizados

| Código | Rota / arquivo |
|--------|----------------|
| 404 | `app/not-found.tsx` |
| 500 | `app/error.tsx` / `app/global-error.tsx` |
| Offline | `/offline` |
| Sem permissão | `/sem-permissao` |

### Testes automatizados

```bash
npm run test:production
npm run typecheck
npm run build
```

E2E opcional contra produção (somente leitura / login):

```bash
E2E_BASE_URL=https://aura-ten-rose.vercel.app E2E_SKIP_WEBSERVER=1 npm run test:e2e:smoke
```

---

## 7. Performance / responsividade

- SSR via App Router; dashboard pages são RSC onde aplicável
- Lazy `import()` das fontes Brain nos services
- Cache in-memory por user/workspace nos engines 7.x
- Validar Desktop / Tablet / Mobile (viewport + smoke Playwright `responsive`)

---

## 8. Logs

`lib/production/logger.ts` — logs mínimos com IDs mascarados e meta redacted.  
Auth já usa `[auth-audit]` com email mascarado.

---

## 9. Rollback

- Reverter deploy na Vercel (Promotion → previous)
- Não dropar tabelas Brain sem backup
- Feature flags implícitas: se migrations não aplicadas, UIs degradam com empty states
