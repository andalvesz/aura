# Fase A — Hardening Final Multiusuário (2026-07-28)

## Policies removidas (storage.objects / alvesz-pdfs)

- `alvesz_pdfs_select_public` (leitura pública do bucket)
- `alvesz_pdfs_insert_own` (prefixo = auth.uid)
- `alvesz_pdfs_update_own`
- `alvesz_pdfs_delete_own`

## Policies criadas

- `alvesz_pdfs_select_member` — path `workspaces/{ws}/...` + `is_workspace_member`
- `alvesz_pdfs_insert_member` — idem + segmento `propostas`
- `alvesz_pdfs_update_member`
- `alvesz_pdfs_delete_member`
- `alvesz_pdfs_select_legacy_owner` — leitura temporária de paths legados (dono ou membro do UUID do 1º segmento)
- `alvesz_pdfs_update_legacy_owner`
- `alvesz_pdfs_delete_legacy_owner`
- Trigger `communication_logs_validate_workspace_refs` + função `user_can_access_workspace_entity`

## Migrations

1. `supabase/migrations/20260728140000_alvesz_pdfs_private_storage_v1.sql`
2. `supabase/migrations/20260728150000_communication_logs_workspace_refs_v1.sql`

## Arquivos alterados / criados

- `app/api/alvesz-proposta-pdf/route.ts` — path canônico, signed URL, rejeita `storage_path` do cliente
- `app/api/alvesz-proposta-pdf/[id]/route.ts` — validação de path, `?signed=1`, DELETE autenticado
- `lib/workspace/alvesz-pdf-storage.ts`
- `lib/workspace/communication-log-refs.ts`
- `lib/comms/communication.service.ts` — validação de refs workspace
- `utils/alvesz-pdf-security.test.ts`
- `scripts/multiuser-security-audit.mjs` — checks de storage/signed URL
- Relatórios SQL/MD em `supabase/reports/`

## Path canônico

`workspaces/{workspace_id}/propostas/{proposal_id}/{arquivo}`

TTL signed URL: **300s**

## Objetos legados fora do padrão

Rodar (somente leitura, não move arquivos):

```sql
\i supabase/reports/20260728_alvesz_pdfs_legacy_objects.sql
```

Classificações esperadas: `legacy_uuid_prefix` (layouts `{user_id}/...` ou `{workspace_id}/...`) e `unknown_layout`.

## communication_logs refs inválidas

```sql
\i supabase/reports/20260728_communication_logs_invalid_refs.sql
```

Sem exclusão automática.

## UNRESOLVED

Ver `supabase/reports/20260728_unresolved_tables_audit.md`.

| Tabela | Recomendação | Escopo alterado? |
|--------|--------------|------------------|
| ad_sets | PERSONAL | Não |
| ad_creatives | PERSONAL | Não |
| funnel_steps | PERSONAL | Não |
| market_benchmarks | SYSTEM | Não |
| specialists | SYSTEM | Não |

## Falhas encontradas (pré-hardening)

1. Bucket `alvesz-pdfs` público + SELECT aberto
2. `getPublicUrl` persistido em `pdf_meta`
3. Path app (`{workspace_id}/...`) desalinhado das policies (`auth.uid` no 1º segmento)
4. `communication_logs` aceitava FKs de workspace sem checar membership

## Riscos remanescentes

1. Objetos legados ainda legíveis por policies temporárias — migrar paths após relatório
2. URLs públicas antigas em `pdf_meta.pdfUrl` podem existir em registros históricos (bucket agora privado → quebram; usar `/api/alvesz-proposta-pdf/{id}`)
3. UNRESOLVED permanece PERSONAL/SYSTEM sem decision product
4. Pixel tracking `mark_communication_opened` continua SECURITY DEFINER (anon) — fora do escopo desta sprint

## Comandos produção

```bash
# 1) Aplicar migrations (Supabase CLI ou script do projeto)
npx supabase db push
# ou
npm run apply-multiuser-migration

# 2) Relatórios somente leitura
# Executar no SQL Editor:
# - supabase/reports/20260728_alvesz_pdfs_legacy_objects.sql
# - supabase/reports/20260728_communication_logs_invalid_refs.sql
# - supabase/reports/20260728_multiuser_integrity_readonly.sql

# 3) Auditoria estática + live
npm run multiuser-security-audit

# 4) Testes de segurança
npm test -- utils/alvesz-pdf-security.test.ts
```

**Nunca** expor `SUPABASE_SERVICE_ROLE_KEY` no cliente.
