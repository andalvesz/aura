# RC2 — Discovery Platform MVP

| Campo | Valor |
|-------|-------|
| Data | 2026-07-29 |
| Status | **DELIVERED** |
| Baseline | RC1 Cognitive Platform · ADR-006 |
| Escopo | Discovery Engine V1 utilizável diariamente (multiusuário / workspace) |

---

## 1. Resumo executivo

RC2 implementa o **Discovery Engine V1** como camada de sinais read-only sobre o Kernel Cognitivo (Identity → Memory → World → Cognitive → **Discovery**). O objetivo muda de “completar arquitetura” para **uso diário por duas pessoas no mesmo workspace**, sem Decision Support e sem Execution.

Toda descoberta persiste com `executionInfluence: "none"`. Feedback (confirmar / rejeitar / arquivar / silenciar) é auditável e respeita suppression.

---

## 2. Funcionalidades prontas para uso

| Capacidade | Status |
|------------|--------|
| Registry + 7 detectores (Opportunity, Risk, Gap, Dependency, Stagnation, Duplicate, Unknown) | Pronto |
| Persistência de Discovery Artifact (payload completo + fingerprint) | Pronto |
| Feedback: confirmar, rejeitar, arquivar, silenciar semelhantes | Pronto |
| Suppression + anti-reaparecimento imediato | Pronto |
| Confidence recalculada no feedback | Pronto |
| `getDiscoveryContextForBrain()` read-only | Pronto |
| Tela `/dashboard/discovery` (seções + filtros + detalhe) | Pronto |
| Timeline unificada Memory → World → Insight → Discovery | Pronto |
| Busca Aura (memórias, entidades, insights, descobertas) | Pronto |
| Resumo no Meu Dia (últimas / risco / oportunidade / confirmação / memórias) | Pronto |
| Navegação cruzada (links entre camadas) | Pronto |
| RLS own-row + workspace member | Pronto (migration) |
| Auditoria (confirm/reject/archive/suppress/feedback) | Pronto |

---

## 3. Funcionalidades pendentes (fora da RC2)

- Decision Support / Scenario / Priority engines
- Execution a partir de Discovery
- Criação automática de missões a partir de candidatos
- LLM híbrido nos detectores (hoje determinístico)
- Regeneração completa de `types/database.ts` após aplicar migration
- Neo4j / vector DB
- Unificação total de Confidence Engine (ADR-005)

---

## 4. Arquitetura

```
Experience → Memory (+Promotion) → World Model → Cognitive Engine
    → Discovery Engine V1 → (Decision Support futuro)
    → Mission / Planner → Execution
```

### Contratos públicos (STABLE em formação)

- `generateDiscoveries` / `bootstrapDiscoveryEngine`
- `listDiscoveries` / `getDiscovery` / `searchDiscoveries`
- `confirmDiscovery` / `rejectDiscovery` / `archiveDiscovery` / `suppressSimilarDiscoveries`
- `getDiscoveryContextForBrain` (`executionInfluence: "none"`)
- `getAuraTimeline` / `getAuraBrainTimeline` / `searchAuraBrain`
- `getDiscoveryDashboardSummary`

### INTERNAL

- `lib/discovery/*` pure engine, registry, detectors, store

### Políticas

- Discovery **consome** Cognitive/World/Memory — não reimplementa raciocínio
- Discovery **não** chama Execution / Planner mutável / criação de missão
- Deduplicação por fingerprint; suppression por `suppressionKey`

### Migration

`supabase/migrations/20260729120000_discovery_engine_v1.sql`

Tabelas: `aura_discovery_artifacts`, `aura_discovery_feedback`, `aura_discovery_suppressions`, `aura_discovery_runs`, `aura_discovery_audit`  
RLS: own-row **ou** `is_workspace_member(workspace_id)`

---

## 5. Testes

| Suite | Resultado |
|-------|-----------|
| `npm run test:discovery` (24) | PASS |
| `npm run test:cognitive` (22) | PASS |
| `npm run test:rc1` (atualizado p/ RC2) | PASS (após ajuste) |
| `npm run typecheck` | PASS |
| `npm run build` | PASS (`/dashboard/discovery` incluída) |
| E2E `e2e/discovery.spec.ts` | Presente (requer credenciais `.env.e2e`) |
| Smoke inclui `/dashboard/discovery` | Sim |

Scripts: `test:discovery`, `test:rc2`

---

## 6. Limitações

1. Persistência best-effort enquanto migration não estiver aplicada no Supabase (store in-memory + upsert).
2. Detectores V1 são determinísticos e conservadores — podem gerar poucos sinais em contas vazias.
3. Busca global de kernel depende dos stores in-memory/DB já hidratados na sessão.
4. Multiuser: engines anteriores (Memory/Cognitive) ainda são majoritariamente own-row; Discovery já abre leitura/escrita de workspace.
5. Sem Decision Support — CTAs são apenas confirmar/rejeitar/arquivar/abrir.

---

## 7. Fluxos obrigatórios (como usar amanhã)

1. **Registrar memória** em `/dashboard/settings/memory` → (promotion/world/cognitive existentes) → em Discovery clicar **Atualizar descobertas**.
2. **Confirmar** uma descoberta → status CONFIRMED, confidence sobe, audit registrado.
3. **Rejeitar** → status REJECTED + suppression (~14 dias) → não reaparece imediatamente.
4. **Abrir** → detalhe com evidências, entidades, memórias, insights, limitações, alternativas, histórico.

---

## 8. Próximos passos

1. Aplicar migration `20260729120000_discovery_engine_v1.sql` nos ambientes.
2. Regenerar `types/database.ts`.
3. Sprint 7.0 — **Decision Support Foundation** (somente após Discovery estável em produção).
4. Ampliar RLS workspace nas engines Memory/World/Cognitive se o uso colaborativo exigir paridade.

---

## 9. Arquivos principais

- `lib/discovery/**` — engine, registry, detectors, timeline, search
- `lib/supabase/services/discovery-engine.service.ts`
- `app/actions/discovery.ts`
- `app/dashboard/discovery/page.tsx`
- `components/dashboard/discovery/**`
- `supabase/migrations/20260729120000_discovery_engine_v1.sql`
- `utils/discovery-engine.test.ts`
- `e2e/discovery.spec.ts`
- `reports/rc2-discovery-platform.md` (este arquivo)

---

## 10. Decisão de parada

**RC2 concluída.** Decision Support e Execution **não** iniciados, conforme escopo.
