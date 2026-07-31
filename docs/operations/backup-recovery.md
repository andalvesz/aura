# Backup & Recovery

**Não há promessa de backup automático** se não estiver configurado no projeto Supabase/Vercel.

## Banco

- Usar backups nativos do Supabase (Point-in-Time se plano permitir)
- Antes de migration: snapshot / export schema
- Rollback lógico: feature flags, suspender beta, não DROP TABLE com dados

## Storage

- Buckets privados com policies
- Não apagar objetos órfãos automaticamente nesta sprint
- Restauração: reupload / signed URL a partir de backup externo se existir

## Configuração de plataforma

- Export versionado: Skill Center / Capabilities / Privacy Center
- Formato `aura-platform-config/v1` e `aura-account-export/v1`

## Workspace

- Ownership: transferir owner antes de exclusão de conta
- Convites: reemitir se token expirado

## Migration falha

1. Parar deploys
2. Avaliar erro (coluna/tabela/RLS)
3. Corrigir migration corretiva idempotente
4. Reaplicar manualmente
5. Regenerar DB types
