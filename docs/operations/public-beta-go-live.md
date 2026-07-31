# Public Beta Go-Live

Checklist para beta privada (sem pagamentos / marketplace).

## Pré-requisitos

- [ ] `NEXT_PUBLIC_SITE_URL` na Vercel (nunca localhost em produção)
- [ ] Migrations 10.0 + 10.1 aplicadas manualmente
- [ ] `AURA_PLATFORM_ADMIN_USER_IDS` com UUIDs de admins
- [ ] Auth email templates apontando para `resolvePublicSiteUrl`
- [ ] Usuários atuais com beta `ACTIVE` (RPC `ensure_beta_active_for_user`)

## Fluxo novo usuário

1. Cadastro → confirmação de e-mail → login  
2. `/dashboard/onboarding` (V2, retomável)  
3. Workspace (criar/entrar)  
4. Skills / capabilities  
5. Home personalizada  

## Validação

- `npm run test:beta`
- `npm run test:platform`
- `npm run typecheck && npm run build`
- E2E autenticado (`.env.e2e`) quando disponível

## Fora de escopo

Pagamentos, marketplace público, Sprint 10.2.
