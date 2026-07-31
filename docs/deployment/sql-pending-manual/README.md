# SQL pending — rode UMA por vez no Supabase SQL Editor

Pacote das migrations que estavam fora do `sql-manual` (gap apos prioritization / antes ou junto do Sprint 10).

**Ordem obrigatoria.** Se alguma ja estiver aplicada, pule.

| # | Arquivo | Escopo |
|---|---------|--------|
| 01 | `01__20260728140000_alvesz_pdfs_private_storage_v1.sql` | Alvesz PDFs storage privado |
| 02 | `02__20260728150000_communication_logs_workspace_refs_v1.sql` | Communication logs workspace refs |
| 03 | `03__20260730260000_sprint7_3_recommendation.sql` | Sprint 7.3 Recommendation |
| 04 | `04__20260731200000_multiuser_cognitive_isolation_corrective.sql` | Multiuser Cognitive Isolation (health RLS) |
| 05 | `05__20260731270000_sprint8_0_planner_v1.sql` | Sprint 8.0 Planner |
| 06 | `06__20260731280000_sprint8_1_automation_engine_v1.sql` | Sprint 8.1 Automation |
| 07 | `07__20260731290000_sprint8_2_agent_runtime_v1.sql` | Sprint 8.2 Agent Runtime |
| 08 | `08__20260731300000_sprint9_1_conversational_command_center.sql` | Sprint 9.1 Conversation |
| 09 | `09__20260731310000_sprint9_2_continuous_learning.sql` | Sprint 9.2 Learning |
| 10 | `10__20260731320000_sprint10_0_saas_skills_platform.sql` | Sprint 10.0 SaaS Skills |
| 11 | `11__20260731330000_sprint10_1_public_beta_readiness.sql` | Sprint 10.1 Public Beta |
| 12 | `12__20260731340000_sprint10_2_private_beta_operations.sql` | Sprint 10.2 Beta Ops |

## Como aplicar
1. Abra Supabase → SQL Editor
2. Cole o conteudo de **um** arquivo
3. Run
4. Confirme sucesso antes da proxima

Se 01–17 de `docs/deployment/sql-manual` ja rodaram, comece daqui pelo `01__` deste pacote (ou pule PDF/comms se ja existirem).

Sprint 10 (10–12 deste pacote) tambem existe em `sql-manual/18–20` — nao rode duas vezes.
