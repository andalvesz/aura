# Migrations checklist — RC4.2 (manual only)

**Regra:** nenhuma migration automática no deploy Vercel.

Marque após aplicar em **staging** e depois em **production**.

---

## Pré

- [ ] Backup Supabase
- [ ] Revisar SQL
- [ ] `npx supabase db push --dry-run` (se CLI configurada)

---

## Multiuser / foundation

- [ ] `20260727120000_multiuser_workspaces_v1.sql`
- [ ] `20260728120000_multiuser_rls_hardening_v1.sql`
- [ ] `20260728140000_alvesz_pdfs_private_storage_v1.sql`
- [ ] `20260728150000_communication_logs_workspace_refs_v1.sql`
- [ ] `20260728180000_aura_brain_core_v1.sql`
- [ ] `20260728190000_mission_engine_v1.sql`

---

## Kernel layers (não alterar código do Kernel nesta RC)

- [ ] `20260728200000_identity_engine_v1.sql`
- [ ] `20260728210000_memory_engine_v1.sql`
- [ ] `20260728220000_world_model_v1.sql`
- [ ] `20260728230000_cognitive_engine_v1.sql`

---

## Discovery → Daily → Capture → Projects → Knowledge

- [ ] `20260729120000_discovery_engine_v1.sql`
- [ ] `20260729140000_rc2_1_collaborative_go_live.sql`
- [ ] `20260729160000_rc3_daily_operations.sql`
- [ ] `20260729180000_rc3_1_smart_capture.sql`
- [ ] `20260729200000_rc4_projects_business_os.sql`
- [ ] `20260729220000_rc4_1_knowledge_hub.sql`

---

## Sprint 7.x (persistência preparada; runtime ainda in-memory)

- [ ] `20260729230000_sprint7_decision_support.sql`
- [ ] `20260729240000_sprint7_1_scenario_engine.sql`
- [ ] `20260729250000_sprint7_2_prioritization.sql`

---

## Pós

- [ ] RLS enabled nas tabelas `aura_*`
- [ ] Checks `execution_influence = 'none'`
- [ ] Storage buckets (Smart Capture / PDFs) com policies
- [ ] Smoke login + segundo usuário
- [ ] Registrar data/hora da aplicação no runbook do time

Lista canônica no código: `BRAIN_MIGRATIONS_RC4_2` em `lib/production/env-checklist.ts`.
