# Sprint 6.2 — Identity Engine V1

## 1. Resumo executivo

Identity Engine funcional com **Identity Claims** atômicas, confidence lifecycle (ADR-005), privacy gates (ADR-007), perfil consolidado, UI **“Como o Aura me entende”**, auditoria, RLS migration e integração **read-only** ao Aura Brain Core (`executionInfluence: "none"`).

Nenhum dado de usuário específico está hardcoded. Pesquisa isolada não vira objetivo. Memory/Graph/Discovery **não** foram implementados.

## 2. Arquitetura implementada

```
UI /dashboard/settings/identity
  → app/actions/identity.ts
  → identity-engine.service.ts
  → lib/identity (puro)
  → store + Supabase best-effort
  → runAuraBrain({ identity })  // hints only
```

Legacy `identity.service.ts` (legado context) **preservado** e separado.

## 3. Arquivos criados / alterados

**Novos**

- `lib/identity/*` (types, confidence, privacy, conflicts, profile, engine, bootstrap, store, index)
- `lib/supabase/services/identity-engine.service.ts`
- `app/actions/identity.ts`
- `app/dashboard/settings/identity/page.tsx`
- `components/dashboard/identity/*`
- `supabase/migrations/20260728200000_identity_engine_v1.sql`
- `utils/identity-engine.test.ts`
- `docs/architecture/identity-engine.md`
- `docs/rfc/RFC-002-identity-engine-implementation.md`
- `reports/sprint-6.2-identity-engine.md`

**Alterados**

- `lib/aura-brain/core.ts`, `types.ts`
- `lib/supabase/services/aura-brain-core.service.ts`
- `lib/supabase/services/index.ts`
- `app/dashboard/settings/aura-brain/page.tsx`
- `package.json`
- `docs/adr/README.md`

## 4. Migrations

`supabase/migrations/20260728200000_identity_engine_v1.sql`

- `aura_identity_claims` + índices + RLS own-row
- `aura_identity_audit` append-only (insert/select own)

Aplicar no Supabase antes de depender da persistência remota.

## 5. Contratos públicos

`getIdentityProfile` · `getIdentityClaims` · `createIdentityClaim` · `observeIdentityEvidence` · `confirmIdentityClaim` · `rejectIdentityClaim` · `correctIdentityClaim` · `archiveIdentityClaim` · `deleteIdentityClaim` · `explainIdentityClaim` · `getIdentityAuditLog` · `getIdentityHintsForBrain`

## 6. Fluxo de confiança

Fonte → baseline → evidências acumuladas → score 0–100 + banda → status.  
Fontes isoladas (discovery/conversation/system_observation) **cap LOW**.  
Confirmação → ~95 CONFIRMED. Histórico nunca silencioso.

## 7. Fluxo confirmação / rejeição

UI/actions → pure engine → audit → invalidate cache → persist.  
REJECTED fora do perfil consolidado; não gera recomendação/missão/objetivo.

## 8. Privacidade

- RLS `auth.uid() = user_id`
- Isolamento workspace no perfil
- Bloqueio de inferência clínica/sensível automática
- Sem share personal→workspace implícito

## 9. Testes

| Suite | Resultado |
|-------|-----------|
| `test:identity` (20) | PASS |
| `test:security` (109) | PASS |
| typecheck | PASS |
| build | PASS (`/dashboard/settings/identity`) |

## 10. Performance

- Perfil ativo filtra REJECTED/ARCHIVED
- Cache de perfil ~5s com invalidação imediata em mutação
- Índices user/status/category/key/context/confidence/workspace

## 11. Limitações conhecidas

- Persistência DB tipada ainda best-effort (tipos Database não regenerados)
- Bootstrap limitado a profile/settings/mission types
- Identity não personaliza ainda o texto do presenter (só slice no Brain)
- Sem Memory promotion ainda

## 12. Pendências

1. Aplicar migration no projeto Supabase  
2. Regenerar tipos Database  
3. E2E autenticado da UI identity  
4. Ligar tom de comunicação do presenter às hints confirmadas (sem execução)

## 13. Recomendação Sprint 6.3

**Memory Engine V1** — tipos episódica/semântica/feedback, TTL, promoção gated (Confidence HIGH ou afirmação) para Identity Claims, sem Discovery completo.

## Definition of Done

- [x] Identity Engine implementada  
- [x] Claims + origem + evidências  
- [x] Confidence lifecycle  
- [x] Confirm/reject/correct/archive/delete  
- [x] Conflitos  
- [x] Perfil consolidado  
- [x] UI “Como o Aura me entende”  
- [x] Privacidade/RLS  
- [x] Auditoria  
- [x] Integração Brain Core (read-only)  
- [x] Sem hardcode de usuário  
- [x] Pesquisa isolada ≠ objetivo  
- [x] Testes  
- [x] Docs + relatório  
- [x] Parar (sem Memory completa)
