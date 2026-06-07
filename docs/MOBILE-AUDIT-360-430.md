# Relatório — Auditoria Mobile Aura OS (360px–430px)

**Data:** 7 de junho de 2026  
**Build:** `npm run build` — sucesso  
**Viewport alvo:** 360px, 375px, 390px, 414px, 430px

---

## Resumo executivo

Auditoria focada em overflow horizontal, tabelas, modais, calendário, CRM (`/dashboard/crescimento`), financeiro e dashboard executivo. Foram aplicadas **32 alterações** em **24 arquivos**, priorizando coluna única abaixo de 640px, touch targets ≥ 44px e contenção de overflow sem quebrar layouts desktop.

---

## 1. Overflow horizontal (global)

| Arquivo | Correção |
|---------|----------|
| `app/globals.css` | `overflow-x: hidden` e `max-width: 100vw` em `html`/`body` |
| `components/ui/modal.tsx` | `min-w-0` + `max-w-[min(100vw,28rem)]` no dialog base |
| `components/dashboard/dashboard-shell.tsx` | *(já tinha `overflow-x-hidden` no `<main>`)* — mantido |
| `components/dashboard/metric-card.tsx` | `break-words` / `line-clamp-2` em valores e hints longos |

---

## 2. Tabelas

| Módulo | Arquivo | Correção |
|--------|---------|----------|
| Alvesz — Estoque | `alvesz-view.tsx` | Container `-mx-3 overflow-x-auto px-3`; coluna Item com `truncate` e `max-w-[120px]`; `min-w-[280px]` na tabela |

**Nota:** Única `<table>` do app. Scroll horizontal localizado quando necessário; demais listas já usam layout flex/card.

---

## 3. Modais

| Arquivo | Correção |
|---------|----------|
| `modal.tsx` | Largura limitada à viewport; bottom sheet full-width no mobile |
| `add-evento-modal.tsx` | Data/hora: `grid-cols-1 sm:grid-cols-2` |
| `add-estoque-modal.tsx` | Qtd/Mín/Unidade: `grid-cols-1 sm:grid-cols-3` |
| `add-orcamento-modal.tsx` | 2 grids responsivos |
| `add-goal-modal.tsx` | Grid responsivo |
| `add-conteudo-modal.tsx` | Grid responsivo |
| `add-alvesz-evento-modal.tsx` | Grid responsivo |
| `add-health-habit-modal.tsx` | Grid responsivo |
| `add-health-session-modal.tsx` | Grid responsivo |
| `alvesz-proposta-modal.tsx` | `max-w-[min(100vw,42rem)]` no mobile |

**Utilitários novos** em `utils/dashboard-mobile.ts`:
- `FORM_GRID_2_CLASS`
- `FORM_GRID_3_CLASS`

---

## 4. Calendário (`/dashboard/calendario`)

| Arquivo | Correção |
|---------|----------|
| `calendario-view.tsx` | Botão "Confirmar sugestão IA" com `w-full sm:w-auto` |
| `mini-calendar.tsx` | *(já responsivo — células `size-9` no mobile)* |
| `instagram-calendar-panel.tsx` | Vista semanal: grid `w-full` sem `min-w-[420px]`; vista mensal: `min-w-[336px]` no mobile + hint de scroll |

---

## 5. CRM — Crescimento (`/dashboard/crescimento`)

| Item | Status |
|------|--------|
| Grids de métricas | Já usavam `grid-cols-1 sm:grid-cols-2` |
| Lista de leads | Layout `flex-col` no mobile + selects `min-h-11` |
| Ações por lead | Botões `w-full sm:w-auto` |
| Pipeline consórcios (CRM secundário) | Ver seção Consórcios |

**Consórcios** (`consorcios-view.tsx`):
- Métricas: `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`
- Pipeline kanban: coluna única no mobile (`PIPELINE_GRID_CLASS`)
- Selects de status: `min-h-11` (touch target)
- Barra de ações: botões full-width no mobile

---

## 6. Financeiro (`/dashboard/financeiro`)

| Arquivo | Correção |
|---------|----------|
| `financeiro-view.tsx` | Linhas receita/despesa: `min-w-0 flex-1` + `truncate` no texto; valores com `shrink-0` |
| Grids de métricas | Já responsivos (`grid-cols-1 sm:grid-cols-2`) |
| Barra de ações | Já com `w-full sm:w-auto` |

---

## 7. Dashboard executivo (`/dashboard`)

| Arquivo | Correção |
|---------|----------|
| `executive-dashboard-view.tsx` | Badge `origem` na agenda oculto abaixo de `sm` (`hidden sm:inline`) |
| `executive-reports-panel.tsx` | `<pre>` com `overflow-x-auto break-words` |
| `comms-dashboard-card.tsx` | Stats: `grid-cols-1 sm:grid-cols-3` (antes 3 colunas fixas) |
| `loading-skeleton.tsx` | Skeleton de métricas: coluna única no mobile |

---

## 8. Outros módulos ajustados

| Módulo | Arquivo | Correção |
|--------|---------|----------|
| Alvesz | `alvesz-view.tsx` | Métricas 1 col; ações full-width; simulador 1 col |
| Social Media | `social-media-view.tsx` | Métricas 1 col no mobile |
| Saúde | `saude-view.tsx` | Métricas 1 col no mobile |
| Instagram Pipeline | `instagram-pipeline-panel.tsx` | Hint "Deslize →" + scroll horizontal intencional |

---

## 9. Itens já conformes (sem alteração)

- Sidebar mobile (drawer + safe-area)
- Header com search full-width em 3 linhas no mobile
- `MiniCalendar` — grid 7 colunas cabe em ~336px de conteúdo
- Touch targets em nav, `ActionButton`, `ICON_BTN_CLASS`
- Inputs 16px no mobile (`globals.css`) — evita zoom iOS
- CRM crescimento — estrutura mobile-first já implementada

---

## 10. Build

```
npm run build
✓ Compiled successfully
✓ TypeScript OK
✓ 58 rotas geradas
```

---

## Checklist de teste manual (360–430px)

- [ ] `/dashboard` — KPIs, prioridades, agenda, relatórios sem scroll horizontal
- [ ] `/dashboard/calendario` — mini calendário + chat IA + modal novo evento
- [ ] `/dashboard/crescimento` — lista de leads, modais follow-up/WhatsApp
- [ ] `/dashboard/financeiro` — listas receita/despesa, modais
- [ ] `/dashboard/consorcios` — pipeline em coluna única
- [ ] `/dashboard/alvesz` — tabela estoque com scroll local
- [ ] `/dashboard/social-media` — calendário Instagram semanal + pipeline
