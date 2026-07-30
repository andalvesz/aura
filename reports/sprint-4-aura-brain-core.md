# Sprint 4 — Aura Brain Core

## Arquitetura final

```
Dados (services/DTOs)
  → Intelligence Engine (lib/intelligence) via adapter
  → Planner
  → Proposed / Executable actions
  → Automation Engine (opcional, idempotente)
  → Audit + Communication presenter
  → UI (Meu Dia + /dashboard/settings/aura-brain)
```

API principal: `runAuraBrain(input)` → objeto estruturado (nunca só texto).

## Identidade

- Comercial: **Aura Brain**
- Subtítulo: “Seu sistema operacional para vida e negócios.”
- Atualizado: login, layout metadata, manifest, sidebars, landing, executive empty, nav group label
- **Expert Brain** não renomeado
- IDs técnicos / env / package name mantidos

## Consórcios

Ver `reports/consorcio-removal.md` — módulo removido da UX ativa; `public.leads` sem DROP.

## Aura Brain Core — arquivos

`lib/aura-brain/` — core, types, autonomy, permissions, audit, context,  
intelligence/adapter, planner/*, actions/*, automations/*, memory/*, learning/*, communication/*

Serviço: `lib/supabase/services/aura-brain-core.service.ts`  
UI: `components/dashboard/aura-brain-activity.tsx`, autonomy controls  
Settings: `app/dashboard/settings/aura-brain/page.tsx`

## Migrations

`supabase/migrations/20260728180000_aura_brain_core_v1.sql`

- aura_brain_settings
- aura_brain_plans
- aura_brain_audit_logs
- aura_brain_feedback
- aura_brain_automations  
Notificações: **reuse** `notifications` (+ tipo `aura_brain_critical`)

## Autonomia

SUGGEST (default) · PREPARE · CONFIRM · AUTO_SAFE  
Confirmação obrigatória: financeiro, externo, exclusão.

## Automações

| id | trigger | ação |
|----|---------|------|
| notify_critical_priority | INTELLIGENCE_GENERATED | create_notification |

Fluxo: CRITICAL → plano curto → create_notification → cooldown/dedupe → audit. Sem e-mail.

## Pendências Sprint 3 — resolvidas

1. Eventos timed (`data_inicio`/`data_fim`) no agregador Meu Dia + skip all-day em conflitos  
2. `invalidateAuraIntelligenceCache({ userId, reason })` + hooks gasto/evento/objetivo/hábito  
3. ExplainWithAI — só tipos  
4. E2E — skips documentados sem creds

## Testes / DoD

| Check | Status |
|-------|--------|
| unit intelligence + aura-brain (29) | PASS |
| test:security (78) | PASS |
| typecheck | PASS |
| build | PASS |
| audit:ui | PASS (dead=0) |
| Playwright aura-brain + my-day | 3 pass · 4 skip (creds) |

## Performance

- Intelligence reutilizado no Meu Dia (sem double run)
- Planner/automations ms no header (dev)
- Automações com cooldown; sem OpenAI

## Riscos / pendências

1. Aplicar migration `20260728180000_aura_brain_core_v1.sql` no projeto Supabase  
2. Settings persistidos em memória + best-effort upsert (tipos DB gerados ainda sem tabela)  
3. Onda 2 Consórcios: desacoplar BI/Social de `utils/consorcios` / `useLeads`  
4. `.env.e2e` local para E2E autenticado  
5. Expert Brain V2 — **não iniciado**  
6. Sem e-mail/WhatsApp/pagamentos/autonomia irrestrita

## Próximos passos sugeridos

- Persistência completa de settings/plans/audit no DB tipado  
- Memory providers ligados a `ai_memories`  
- Business Lab além do draft tipado  
- Desacoplar restante de `public.leads` no Social/BI  
