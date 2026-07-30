# UI Functional Audit

Generated: 2026-07-28T17:53:23.478Z

## Totals

| Métrica | Valor |
|---------|-------|
| Rotas (pages) | 72 |
| Ações inventariadas | 717 |
| Botões (scan estático) | 244 |
| Forms | 52 |
| API handlers | 263 |
| Nav links | 59 |
| Server actions | 17 |
| Placeholders | 10 |
| Dead buttons / flags | 0 |
| Smoke probes | 25 |
| Falhas agregadas | 0 |
| Playwright tests | 3 |
| Playwright passed | -1 |
| Playwright failed | 0 |
| Playwright skipped | 4 |

## Status legend

TESTED_PASS · TESTED_FAIL · BLOCKED_ENV · PLACEHOLDER · DEAD_BUTTON · MISSING_ROUTE · PERMISSION_BLOCKED · NOT_TESTED

## Placeholders / dead patterns (static)

- **PLACEHOLDER** `components/dashboard/executive-reports-panel.tsx` — em breve
- **PLACEHOLDER** `components/dashboard/modules/creative-director-view.tsx` — em breve
- **PLACEHOLDER** `components/dashboard/modules/integrations-view.tsx` — em breve
- **PLACEHOLDER** `components/dashboard/modules/knowledge-connect-view.tsx` — em breve
- **PLACEHOLDER** `components/dashboard/modules/knowledge-sources-view.tsx` — em breve
- **PLACEHOLDER** `components/dashboard/modules/platforms-view.tsx` — em breve
- **PLACEHOLDER** `components/dashboard/reset-test-data-button.tsx` — TODO/FIXME
- **PLACEHOLDER** `app/api/alvesz-proposta-ia/route.ts` — TODO/FIXME
- **PLACEHOLDER** `app/api/expert-brain/queue/route.ts` — console.log present
- **PLACEHOLDER** `app/api/expert-brain-queue/route.ts` — console.log present



## Failures

_Nenhuma falha agregada ainda (rode E2E)._

## Corrections made in this sprint

- Alvesz PDF: bucket privado, signed URLs, path canônico
- communication_logs: validação de refs de workspace
- Inventário + Playwright scaffold

## Still manual / blocked by env

- Fluxos destrutivos (create/edit/delete) exigem `E2E_ALLOW_DESTRUCTIVE=1` + credenciais em `.env.e2e`
- Integrações Google Drive / Gmail / Meta — mock ou BLOCKED_ENV
- Expert Brain processing de cursos reais — nunca nos testes
- Produção: apenas smoke de leitura

## Commands

```bash
npm run audit:ui
npm run test:e2e
npm run test:e2e:report
npm run audit:all
```
