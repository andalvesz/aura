# Sprint 10.2 — Private Beta Operations

## 1. Resumo executivo

A Sprint 10.2 entrega a fundação operacional da beta privada: convites com token hasheado, cohorts, admin beta, feedback/bugs, releases/changelog/anúncios, rollout gradual, error inbox, correlation IDs, analytics com consentimento, first value, support mode sem impersonação, diagnóstico sanitizado, maintenance e rollback lógico. Sem pagamentos e sem marketplace público. Kernel cognitivo intacto.

## 2. Auditoria

| Componente | Pronto | Parcial | Ausente | Ação |
|---|---|---|---|---|
| Beta access | | ✓ 10.1 | | Estendido com invites |
| Onboarding | ✓ | | | Integrado first value |
| Admin platform | | ✓ | | Painel beta ops |
| Observabilidade | | ✓ | | Error groups + corr |
| Platform Health | | ✓ | | Product health |
| Feature flags | | ✓ | | Rollout gradual |
| Notificações | | ✓ ops internas | | Sem e-mail externo |
| Feedback ops | ✓ | | | Novo |
| Support | ✓ | | | Sem impersonação |
| Releases | ✓ | | | Novo |
| Migrations 10.2 | ✓ SQL | | | Manual apply |
| Rate limits | ✓ buckets | in-process | | Extensão |
| Privacidade analytics | ✓ | | | Camadas |
| Export/delete | | ✓ 10.1 | | Sem mudança |

## 3–20. Entregas

- **Invites:** `lib/beta-ops/invites.ts` + `/beta/invite/[token]`
- **Cohorts:** FOUNDERS…CUSTOM — não authz
- **Admin:** `/dashboard/admin/platform` + Error Inbox
- **Feedback:** `/dashboard/feedback` + triage admin
- **Bugs:** botão global com consentimento
- **Releases / Changelog:** `/dashboard/changelog`
- **Announcements:** escopos global/cohort/workspace/user/capability
- **Rollout:** percent determinístico + cohort/user/workspace
- **Error inbox:** agrupado, workspace anonimizado
- **Correlation ID:** `lib/beta-ops/correlation.ts` + UI de erro
- **Analytics / First value / Product health:** módulos dedicados
- **Support / Diagnostics / Maintenance / Rollback:** conforme DoD

## 21. Privacy

Defaults seguros: product/performance/providers off; essential sempre on.

## 22. Segurança

Testes cobrem forge/reuse/expire/email mismatch, feedback cross-user, admin allowlist, rollout estável, announcement scope, diagnostics sem secrets, analytics sem consent, rate limit, impersonation forbidden.

## 23. Migration

`20260731340000_sprint10_2_private_beta_operations.sql` (+ manual `20__*`). Não aplicar auto em produção.

## 24. E2E

`e2e/beta-ops.spec.ts` — fluxo Admin/A/B (credential-gated). Cenário unitário completo em `test:beta-ops`.

## 25. Testes

`npm run test:beta-ops` — cobertura dos itens do DoD em memória.

## 26. Limitações

- Persistência runtime ainda predominantemente in-memory (SQL pronto)
- Rate limit in-process (não distribuído)
- Sem e-mail transacional de convite
- Health probes ainda parcialmente stub

## 27. Pendências

- Wire Supabase load/persist para tabelas 10.2
- Regenerar `types/database.ts`
- Rate limit distribuído
- E2E CI com 2–3 usuários reais

## 28. Prontidão para beta privada real

**Sim, com ressalvas:** operação funcional em memória + UI + policies SQL; produção exige aplicar migration e ligar persistência.

## 29. Recomendação Sprint 10.3

Persistência completa das fatias ops, e-mail de convite, rate limit distribuído, probes de health reais, e endurecimento CI E2E multi-usuário — **sem** pagamentos/marketplace.
