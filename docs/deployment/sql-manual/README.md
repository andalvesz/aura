# SQL manual — ordem de execução no Supabase

Abra **um arquivo por vez** no SQL Editor do Supabase. Não rode tudo de uma vez.

| # | Arquivo | Escopo |
|---|---------|--------|
| 01 | `01__20260727120000_multiuser_workspaces_v1.sql` | Workspaces / convites |
| 02 | `02__20260728120000_multiuser_rls_hardening_v1.sql` | RLS multiuser |
| 03 | `03__20260728180000_aura_brain_core_v1.sql` | Brain core |
| 04 | `04__20260728190000_mission_engine_v1.sql` | Missions |
| 05 | `05__20260728200000_identity_engine_v1.sql` | Identity |
| 06 | `06__20260728210000_memory_engine_v1.sql` | Memory |
| 07 | `07__20260728220000_world_model_v1.sql` | World |
| 08 | `08__20260728230000_cognitive_engine_v1.sql` | Cognitive |
| 09 | `09__20260729120000_discovery_engine_v1.sql` | Discovery |
| 10 | `10__20260729140000_rc2_1_collaborative_go_live.sql` | Go-live colaborativo |
| 11 | `11__20260729160000_rc3_daily_operations.sql` | Daily ops |
| 12 | `12__20260729180000_rc3_1_smart_capture.sql` | Smart Capture |
| 13 | `13__20260729200000_rc4_projects_business_os.sql` | Projects |
| 14 | `14__20260729220000_rc4_1_knowledge_hub.sql` | Knowledge |
| 15 | `15__20260729230000_sprint7_decision_support.sql` | Decision Support |
| 16 | `16__20260729240000_sprint7_1_scenario_engine.sql` | Scenario |
| 17 | `17__20260729250000_sprint7_2_prioritization.sql` | Prioritization |
| 18 | `18__20260731320000_sprint10_0_saas_skills_platform.sql` | Sprint 10.0 SaaS |
| 19 | `19__20260731330000_sprint10_1_public_beta_readiness.sql` | Sprint 10.1 Beta |
| 20 | `20__20260731340000_sprint10_2_private_beta_operations.sql` | Sprint 10.2 Ops |

## Gap (recomendação → learning + isolamento)

Se você já rodou até a **17** (ou até a **20** parcialmente), use o pacote separado:

→ [`docs/deployment/sql-pending-manual/`](../sql-pending-manual/README.md)

Lá estão **12 arquivos**, um por migration, na ordem correta (PDF storage → … → Sprint 10.2 + isolamento multiusuário).

Se alguma migration antiga já estiver aplicada, pule e continue da próxima.
