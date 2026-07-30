# Sprint 4 — Auditoria pré-alteração

**Data:** 2026-07-28  
**Escopo:** identidade Aura → Aura Brain · remoção Consórcios · prep Aura Brain Core

## Classificações

| Código | Significado |
|--------|-------------|
| RENAME | Atualizar texto/visual para Aura Brain |
| REMOVE | Remover da experiência ativa |
| KEEP_LEGACY | Manter (técnico, migration, Expert Brain, IDs) |
| DATABASE_MIGRATION | Exige migration nova / análise de dados |
| MANUAL_REVIEW | Taxonomia compartilhada ou decisão de produto |

---

## A — Identidade “Aura”

| Local | Atual | Classificação |
|-------|-------|---------------|
| `components/auth/auth-form.tsx` | Logo “Aura” | RENAME |
| `app/layout.tsx` metadata | “Aura OS” | RENAME |
| `public/manifest.json` | Aura OS / Aura | RENAME |
| `components/dashboard/sidebar.tsx` | “Aura” | RENAME |
| `components/dashboard/mobile-sidebar.tsx` | “Aura” | RENAME |
| `components/landing/*` | “Aura” | RENAME |
| `app/convite/[token]/page.tsx` | “Aura” | RENAME |
| `components/dashboard/executive-dashboard-view.tsx` | “Aura OS” | RENAME |
| `README.md` | `# Aura` | RENAME |
| `lib/modules.ts` group label “Aura” | label | RENAME (label only) |
| `lib/modules.ts` `id: "aura"` | routing key | KEEP_LEGACY |
| `package.json` name | `aura` | KEEP_LEGACY |
| Expert Brain (módulo/APIs/migrations) | Expert Brain | KEEP_LEGACY |
| Env / tabelas / rotas `/api/aura-*` | técnicos | KEEP_LEGACY |
| Sub-marcas (Aura CEO, CopyLab…) | feature brands | MANUAL_REVIEW |
| `utils/notifications.ts` copy | “Central… Aura” | RENAME (copy) |

---

## B — Consórcios

Ver detalhe em `reports/consorcio-removal.md`.

### Resumo

| Camada | Status |
|--------|--------|
| Menu / `MODULES` | Já ausente |
| Rota `/dashboard/consorcios` | Stub redirect → crescimento |
| `ConsorciosView` | Órfão — REMOVE |
| `public.leads` + service/hooks | Ainda alimenta BI/Social/workspace — REMOVE da app |
| Growth vertical `consorcios` | MANUAL_REVIEW — manter taxonomia |
| Instagram marca `consorcios` | MANUAL_REVIEW |
| Finance origem `consorcios` | MANUAL_REVIEW |
| Business Lab niche `consorcio` | MANUAL_REVIEW — não é o módulo |
| Migrations históricas | KEEP_LEGACY — nunca apagar |

---

## C — Infra a reutilizar (Aura Brain Core)

| Necessidade | Decisão |
|-------------|--------|
| Notificações internas | REUSE `notifications` |
| Settings / autonomia | NEW `aura_brain_settings` |
| Plans | NEW `aura_brain_plans` (+ steps JSON) |
| Action audit trail | NEW `aura_brain_audit_logs` |
| Feedback learning | NEW `aura_brain_feedback` |
| Automations config | NEW `aura_brain_automations` (registry + DB flags) |
| Memórias conversacionais | REUSE `ai_memories` via provider |
| Eventos timed | `eventos.data_inicio/fim` timestamptz — OK |

---

## D — Intelligence Engine / Sprint 3

| Item | Ação |
|------|------|
| Timed events no agregador | Corrigir — passar start/end reais |
| Cache invalidation central | Expandir + hooks em services |
| ExplainWithAI | KEEP interface tipada only |
| E2E creds | Documentar `.env.e2e` — não commit |

---

## E — Arquivos críticos a tocar nesta sprint

**Novos:** `lib/aura-brain/**`, migrations `aura_brain_*`, UI settings, reports.

**Remoção ativa Consórcios:** view, leads feed no dashboard/BI/social/quick-actions, service callers.

**Identidade:** auth, layout, manifest, sidebars, landing, executive empty.

**Não tocar:** Expert Brain V2, migrations antigas, enums growth/instagram sem migration.
