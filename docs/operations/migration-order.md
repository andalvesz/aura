# Migration order — Aura Brain

**Não aplicar automaticamente em produção.**

## Ordem oficial (manual)

1. Workspaces / multiuser (já aplicadas em ambientes vivos)
2. Aura Brain core → Identity → Memory → World → Cognitive → Discovery
3. RC / sprint engines (missions, projects, knowledge, decision… learning)
4. **Sprint 10.0** `20260731320000_sprint10_0_saas_skills_platform.sql`
5. **Sprint 10.1** `20260731330000_sprint10_1_public_beta_readiness.sql`
6. **Sprint 10.2** `20260731340000_sprint10_2_private_beta_operations.sql`

Cópias manuais: `docs/deployment/sql-manual/18__*`, `19__*` e `20__*`.

## Após aplicar

1. Verificar RLS nas tabelas `aura_*` de platform e beta-ops
2. Regenerar tipos: `npx supabase gen types typescript …`
3. Mesclar em `types/database.ts` (remover adaptações best-effort quando possível)
4. Validar `ensure_beta_active_for_user` RPC
5. Validar tabelas `aura_beta_invites`, `aura_feedback_items`, `aura_releases`, `aura_error_groups`

## Rollback lógico

Não dropar tabelas com dados de usuários. Preferir feature flags / suspender beta / desativar capabilities / rollback de release channel. Ver `docs/operations/feature-rollout.md` e `docs/operations/release-process.md`.

**Nunca** fazer rollback destrutivo automático de migrations.
