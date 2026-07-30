# Identity Engine — Documentação técnica

**Sprint:** 6.2  
**ADRs:** 001, 002, 005, 007 · **RFC:** 001, 002  
**Facade principal:** `getIdentityProfile()`

## O que é

O Identity Engine representa **quem o usuário é** como um conjunto de **Identity Claims** independentes — cada afirmação com origem, evidências, confiança e lifecycle.

Não é Memory (eventos do dia). Não é Knowledge Graph (relações). Não executa ações.

## Princípios (obrigatórios)

1. Entender antes de agir  
2. Perguntar antes de assumir  
3. Toda informação tem origem  
4. Toda inferência tem confiança  
5. Corrigível / removível  
6. Observado ≠ confirmado  
7. Sem rótulos permanentes  
8. Usuário é autoridade final  
9. Sem vazamento cross-user / cross-workspace  
10. Sem hardcode de usuários ou exemplos de vida real no código

## Arquitetura

```
UI "Como o Aura me entende"
  → server actions (app/actions/identity.ts)
  → identity-engine.service.ts (auth + persistência)
  → lib/identity/* (puro: engine, confidence, privacy, profile)
  → store em memória + best-effort Supabase
  → Aura Brain Core (slice read-only, executionInfluence: none)
```

### Pacote `lib/identity/`

| Arquivo | Função |
|---------|--------|
| `types.ts` | IdentityClaim, profile, sources |
| `confidence.ts` | Lifecycle ADR-005 |
| `privacy.ts` | Bloqueio ADR-007 |
| `conflicts.ts` | Detecção de incompatíveis |
| `profile.ts` | Perfil consolidado |
| `engine.ts` | Operações puras |
| `bootstrap.ts` | Import seguro de dados confirmados |
| `store.ts` | Estado + cache curto |
| `index.ts` | Surface pública |

## Contratos públicos

```
getIdentityProfile()
getIdentityClaims()
createIdentityClaim()
observeIdentityEvidence()
confirmIdentityClaim()
rejectIdentityClaim()
correctIdentityClaim()
archiveIdentityClaim()
deleteIdentityClaim()
explainIdentityClaim()
getIdentityAuditLog()
getIdentityHintsForBrain()
```

## Status lifecycle

`UNKNOWN → OBSERVED → HYPOTHESIS → LIKELY → CONFIRMED / LEARNED`  
Também: `OUTDATED`, `ARCHIVED`, `REJECTED`

- **REJECTED:** fora do perfil; não gera recomendação/missão/objetivo; só auditoria / anti-repetição  
- Confirmação explícita → confiança alta + CONFIRMED  
- Discovery/conversation isolados **não** criam goals de média/alta confiança

## Migrations

Arquivo: `supabase/migrations/20260728200000_identity_engine_v1.sql`

Tabelas:

- `aura_identity_claims` (RLS own-row)
- `aura_identity_audit` (append-only insert para owner)

Aplicar no projeto Supabase antes de depender da persistência remota. Sem a migration, o engine funciona em memória de processo + best-effort.

## UI

Rota: `/dashboard/settings/identity`  
Título: **Como o Aura me entende**  
Link também a partir de `/dashboard/settings/aura-brain`

## Testes

```bash
npm run test:identity
npm run test:security
```

## O que esta sprint NÃO faz

Memory Engine completo · Knowledge Graph · Discovery · Opportunity · Self Reflection · execução automática por identidade · perfis psicológicos / clínicos
