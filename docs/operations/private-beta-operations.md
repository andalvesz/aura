# Private Beta Operations

Operação da beta privada do Aura Brain (Sprint 10.2).

## Objetivos

- Convidar usuários com token hasheado
- Cohorts (não são autorização)
- Feedback / bugs
- Releases + changelog + anúncios internos
- Rollout gradual de feature flags
- Error inbox anonimizado
- Correlation IDs
- Métricas agregadas + First Value
- Support Mode sem impersonação
- Diagnóstico sanitizado
- Maintenance mode
- Rollback lógico (flags / release / skills)

## Fluxo de convite

1. Admin cria convite em `/dashboard/admin/platform`
2. Token plaintext retornado **uma vez**; só `token_hash` (SHA-256) é persistido
3. Link: `{resolvePublicSiteUrl()}/beta/invite/{token}`
4. Aceite exige e-mail correspondente, status PENDING e não expirado
5. Reuso / forge / revoke falham com auditoria

## Admin

Allowlist: `AURA_PLATFORM_ADMIN_USER_IDS`. Sem impersonação. Sem conteúdo privado.

## Feedback & bugs

- `/dashboard/feedback`
- Botão global **Reportar problema** (consentimento para metadados)
- Nunca captura senhas, tokens, memórias, prompts ou documentos

## Migrations

Aplicar manualmente: `20260731340000_sprint10_2_private_beta_operations.sql`  
Ver `migration-order.md`.

## Testes

```bash
npm run test:beta-ops
```
