# Fix: Server/Client Boundary — `resolveDashboardDisplayName`

**Data:** 2026-07-30  
**Escopo:** Correção de fronteira Server/Client no Next.js (sem alteração de comportamento)

---

## Erro de produção

```
Attempted to call resolveDashboardDisplayName() from the server
but resolveDashboardDisplayName is on the client.
```

---

## Causa

`resolveDashboardDisplayName` era uma **função utilitária pura** (string trim / split / fallback), mas estava declarada e exportada em:

`components/dashboard/dashboard-user-context.tsx`

Esse arquivo tem `"use client"` porque contém React Context (`DashboardUserProvider`, `useDashboardUser`).

O Server Component `components/dashboard/my-day.tsx` importava a utilidade a partir desse módulo client. No build/produção, o Next.js trata qualquer export de um módulo `"use client"` como código de cliente e bloqueia a chamada a partir do servidor.

---

## Correção

1. **Criado** `lib/dashboard/display-name.ts` — módulo compartilhado **sem** `"use client"`, contendo apenas a função pura (sem React, hooks, browser APIs ou APIs de servidor).
2. **Removida** a declaração de `resolveDashboardDisplayName` de `dashboard-user-context.tsx` (o arquivo permanece client apenas para Context/Provider/hook).
3. **Atualizados** os imports para apontar para `@/lib/dashboard/display-name`.
4. **Não foi necessário** criar `useDashboardDisplayName()` — a função não usa hooks; o hook existente `useDashboardUser()` continua no módulo client e apenas consome o `displayName` já resolvido.

Não houve duplicação de lógica nem mudança de comportamento.

---

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `lib/dashboard/display-name.ts` | **Novo** — função pura `resolveDashboardDisplayName` |
| `components/dashboard/dashboard-user-context.tsx` | Removida export da utilidade; mantidos Provider + `useDashboardUser` |
| `components/dashboard/dashboard-shell.tsx` | Import da utilidade movido para `lib/dashboard/display-name` |
| `components/dashboard/my-day.tsx` | Import da utilidade movido para `lib/dashboard/display-name` |

---

## Componentes afetados

| Componente | Tipo | Uso |
|------------|------|-----|
| `MyDay` | Server Component | Resolve nome a partir de `profiles.full_name` / e-mail |
| `DashboardShell` | Client Component | Resolve nome e passa para `DashboardUserProvider` |
| `DashboardUserProvider` / `useDashboardUser` | Client | Sem mudança de API; consumidores (`AuraCentral`, `DailyOperationsPanel`) intactos |

---

## Revisão das páginas do dashboard

As páginas em `app/dashboard/**` importam componentes client para UI interativa (boards, modals, views), não apenas para utilidades. O único caso de Server Component importando utilidade de módulo `"use client"` era `my-day.tsx` → `dashboard-user-context.tsx`.

---

## Resultado

| Comando | Resultado |
|---------|-----------|
| `npm run typecheck` | Exit 0 |
| `npm run build` | Exit 0 — compile OK, TypeScript OK |

**Zero ocorrências** de `Attempted to call ... from the server` no build.

Comportamento da aplicação preservado: mesma lógica de resolução de nome (primeiro nome do `fullName`, senão local-part do e-mail, senão `"você"`).
