# Feature rollout

Resolução **server-side**, estável por usuário (`sha256(flag:userId) % 100`).

## Dimensões

- Percentual 0–100
- Cohorts (não authz)
- User allowlist
- Workspace allowlist
- Ambiente

## Precedência efetiva

1. Rollout desabilitado / ausente → off
2. Ambiente mismatch → off
3. User allowlist → on
4. Workspace allowlist → on
5. Cohort match → on
6. Percent bucket

## Rollback rápido

```ts
executeFlagRollback(key, actorId) // percent=0, enabled=false
```

Autorização continua separada (`permissions` / RLS / roles). Flags nunca substituem authz.

Auditoria: evento `feature_rollout_updated` / `rollback_action`.
