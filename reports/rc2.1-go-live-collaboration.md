# RC2.1 — Go-Live colaborativo do Aura Brain

| Campo | Valor |
|-------|-------|
| Data | 2026-07-29 |
| Status | **DELIVERED** (código + testes; migrations manuais) |
| Baseline | RC2 Discovery Platform |
| Escopo | Ativação, segurança, colaboração, estabilidade |
| Fora de escopo | Decision Support · Planner inteligente · Automações · Execution · Sprint 7.0 |

---

## 1. Resumo executivo

A RC2.1 prepara o Aura Brain para **uso diário real por dois usuários no mesmo workspace**, sem iniciar Decision Support nem Execution. Entregas principais:

- Migration colaborativa de visibilidade + RLS (`visibility_scope`, `row_version`)
- Política de visibilidade fail-closed (`PRIVATE` default)
- Tipos oficiais Brain (`types/aura-brain-database.ts` → `Database`)
- Persistência Discovery alinhada ao schema (sem `LooseClient` no Discovery service)
- Feedback colaborativo com concorrência otimista
- Onboarding, estados vazios, Meu Dia e bootstrap com mensagens/correlationId
- Suíte `test:go-live` + checklist operacional

`executionInfluence` permanece `"none"` em todo o pipeline.

---

## 2. Migration

| Arquivo | Papel |
|---------|-------|
| `supabase/migrations/20260729120000_discovery_engine_v1.sql` | Discovery V1 (já existente; **não** auto-aplicar em prod) |
| `supabase/migrations/20260729140000_rc2_1_collaborative_go_live.sql` | Visibilidade + RLS Memory/World/Cognitive/Discovery + `row_version` |

Checklist manual: `docs/operations/rc2-go-live-checklist.md`.

---

## 3. DB types

- `types/aura-brain-database.ts` — rows espelhando migrations (Identity, Memory, World, Cognitive, Discovery)
- `types/database.ts` — `Tables & AuraBrainTables` + função `aura_brain_visibility_readable`
- Após aplicar migrations no projeto: regenerar com `supabase gen types` e mesclar (ver checklist)
- Discovery service usa client tipado (`SupabaseClient<Database>`); adapter LooseClient removido **do Discovery**

Adapters LooseClient ainda existem em Identity/Memory/World/Cognitive/Mission (best-effort legado) — remoção completa após regeneração live e validação de schema.

---

## 4. Workspace

Fluxo coberto por código existente + testes de política:

- Criação/seleção, convite, aceite, papéis, membro ativo/removido, troca de contexto
- Isolamento workspace ↔ workspace
- Isolamento PRIVATE vs WORKSPACE
- Sem hardcode de usuários

---

## 5. Política de visibilidade

Documentada em `docs/architecture/visibility-policy.md` e implementada em `lib/aura-brain/visibility.ts`.

| Escopo | Status RC2.1 |
|--------|----------------|
| PRIVATE | Default seguro |
| WORKSPACE | Só com ato explícito / consent workspace |
| SHARED_WITH_SELECTED_MEMBERS | **Não suportado** → resolve para PRIVATE |
| SYSTEM_INTERNAL | Audit / sistema |

Defaults: Memory, World, Cognitive, Discovery, feedback, suppression, timeline → **PRIVATE** (fail closed).

---

## 6. Fluxo colaborativo

Usuário A (memória compartilhada) → Memory → Promotion → World → Cognitive → Discovery → Usuário B visualiza → feedback → Usuário A vê histórico. Sem execução operacional.

Fingerprint/suppressionKey incluem `workspaceId` para evitar colisão entre workspaces.

---

## 7. Onboarding

`components/dashboard/aura-brain-onboarding.tsx` — linguagem simples (memória privada vs compartilhada, confiança, tipos de sinal, confirmar ≠ executar). Embutido em `/dashboard/discovery`.

---

## 8. Feedback

Confirmar / rejeitar / arquivar / silenciar; histórico com `actorUserId` + audit; `row_version` + conflito na UI; confirmação **não** vira fato operacional (`confirmationIsNotFact` / `executionInfluence: none`).

---

## 9. Busca

`searchAuraBrain` consome fontes já filtradas por contexto; gate `filterByVisibility` / `canViewerAccess` para fail-closed. Paginação/limite preservados.

---

## 10. Timeline

Campos: ator, evento, camada, origem, data, workspace, links. UI em `discovery-timeline.tsx`. Eventos PRIVATE não vazam via gate de listagem.

---

## 11. Meu Dia

`DiscoveryDashboardSummary` — recentes, risco, oportunidade, pendentes, memórias; copy de indício (“merecem atenção”, empty states acionáveis). Sem linguagem de decisão/tarefa obrigatória.

---

## 12. RLS

Migration RC2.1: `aura_brain_visibility_readable` para SELECT em Memory/World/Cognitive/Discovery (WORKSPACE somente se `visibility_scope = WORKSPACE` + membership). Testes unitários espelham políticas em `utils/rc2-1-go-live.test.ts`. Validação live no checklist.

---

## 13. Concorrência

`expectedVersion` / `rowVersion`; segundo write retorna conflito; UI exibe mensagem e refresh; histórico da primeira escrita preservado.

---

## 14. Observabilidade

`DiscoveryRun.metrics` + persistência em `aura_discovery_runs.report` (sem conteúdo de memória/prompts/secrets): duração, detectores, registros, gerados, dedupe, suppressed, falhas, cache, workspace, correlationId.

---

## 15. Testes

| Suite | Resultado |
|-------|-----------|
| `test:go-live` | PASS (18) |
| `test:discovery` | PASS (24) |
| `test:rc1` | PASS (6) |
| `test:identity` / `memory` / `world` / `cognitive` | PASS (20 / 38 / 50 / 22) |
| `typecheck` / `build` | PASS |

Script novo: `npm run test:go-live`.

---

## 16. Limitações

- Migrations **não** aplicadas automaticamente neste ambiente
- Regeneração live de `database.ts` via CLI ainda é passo manual pós-apply
- LooseClient permanece em engines não-Discovery até regeneração completa
- `SHARED_WITH_SELECTED_MEMBERS` sem ACL de membros
- Sem cron obrigatório de Discovery
- Feedback não cria missões / execução

---

## 17. Pendências

- Aplicar migrations em staging/prod (checklist)
- Regenerar tipos a partir do projeto Supabase real
- Remover LooseClient remanescentes
- E2E multiuser com credenciais `.env.e2e`
- Validação mobile física

---

## 18. Prontidão para uso diário

**Condicional: SIM** após checklist operacional (migrations + tipos + convite do 2º usuário + E2E manual). Código e testes de colaboração/visibilidade estão prontos.

---

## 19. Prontidão para Decision Support

**NÃO.** Decision Support / Execution / Sprint 7.0 **não iniciados**. Gate: `executionInfluence: "none"`.

---

## Definition of Done

| Critério | Status |
|----------|--------|
| Migration pronta para aplicação manual | ✅ |
| DB types Brain atualizados no repo | ✅ |
| Dois usuários / mesmo workspace (engine + política) | ✅ |
| Dados privados permanecem privados | ✅ |
| Memórias compartilhadas alimentam pipeline | ✅ (via WORKSPACE + contexto) |
| Ambos visualizam descobertas autorizadas | ✅ |
| Feedback colaborativo + cache invalidate | ✅ |
| Busca / timeline respeitam visibilidade | ✅ |
| Meu Dia utilizável + onboarding + empty states | ✅ |
| `test:go-live` + regressões Discovery/RC1 | ✅ |
| `executionInfluence` = none | ✅ |
| Decision Support / Execution não iniciados | ✅ |
