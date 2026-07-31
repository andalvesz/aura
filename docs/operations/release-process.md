# Release process

## Channels

- `INTERNAL` — equipe
- `BETA` — usuários convidados
- `STABLE` — futuro (pós beta)

## Status

`DRAFT` → `READY` → `RELEASED` → (`ROLLED_BACK` | `ARCHIVED`)

## Publicar

1. Criar release (admin)
2. Preencher changes / known issues / migrationRequired
3. Publicar → status `RELEASED` + notificação interna
4. Usuários veem em `/dashboard/changelog` e podem marcar como lido

## Rollback de release

- Status → `ROLLED_BACK`
- Anunciar problema conhecido
- Preferir flag rollback / desativar capability
- **Nunca** dropar migration automaticamente

Ver também `feature-rollout.md` e `ROLLBACK_PLAYBOOK` em `lib/beta-ops/rollback.ts`.
