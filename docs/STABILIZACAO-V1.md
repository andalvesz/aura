# Sprint de Estabilização — Aura OS v1.0

Data: 2026-06-03  
Escopo: auditoria e correções. Sem novas funcionalidades.

## Correções aplicadas nesta sprint

| Item | Correção |
|------|----------|
| Orçamento fictício R$ 6.000 | Removido `ORCAMENTO_MENSAL`; mentor e `computeFinanceStats` não exibem saldo inventado |
| Prioridades de orçamento | Filtro usa `normalizeOrcamentoStatus` (rascunho/enviado/negociação) em vez de status `pendente` inexistente |
| Saudação hardcoded | Nome do perfil/e-mail via `DashboardUserProvider` + `resolveUserDisplayName` no servidor |
| JSON.parse na análise de relatórios | Trocado por `safeJsonParse` |
| Busca global no mobile | Campo em linha própria no header (`basis-full` em telas pequenas) |

---

## 1. O que está ~100%

| Módulo | CRUD Supabase | IA | Observação |
|--------|---------------|-----|------------|
| Financeiro | Sim | N/A | Receitas, gastos, metas; saldo = receitas − despesas reais |
| Calendário | Sim | Aura Agenda API | Criar/listar eventos; confirmação de sugestão |
| Busca global | Sim | N/A | 13 tabelas, filtros, paginação |
| Relatórios | Sim | Análise IA + fallback | Diário/semanal/mensal; copiar texto |
| Auth / sessão | Sim | N/A | `requireUser` no dashboard; proxy Supabase |
| Offline (parcial) | Sim | N/A | Tabelas configuradas em `use-supabase-crud` |

---

## 2. O que está ~90%

| Módulo | Gap |
|--------|-----|
| Aura Central | Múltiplos fluxos (busca, relatório, evento, treino); depende de `OPENAI_API_KEY` |
| Dashboard executivo | 10+ hooks Supabase no mount; feed IA opcional com fallback local |
| Crescimento | Migrations growth obrigatórias; CRM + metas + missões |
| Alvesz | PDF depende do bucket `alvesz-pdfs` no Supabase |
| Saúde | Coach IA + CRUD hábitos/treinos/refeições |
| Social Media | IA + conteúdos; roteiro em API separada |
| Notificações | Geração server-side; requer tabela/migration |

---

## 3. O que está incompleto

| Item | Detalhe |
|------|---------|
| Exportação PDF | Propostas Alvesz e relatórios: `pdfMeta` preparado, geração “em breve” |
| Overview da sidebar | `lib/modules.ts` usa placeholders estáticos (`0`, `—`) até integração dinâmica |
| Consórcios | Módulo legado de leads separado do `growth_leads` |
| Testes E2E | Apenas testes unitários Node (`npm test`) |
| PWA / push | Não auditado nesta sprint |

---

## 4. Bugs encontrados e status

| Bug | Severidade | Status |
|-----|------------|--------|
| Saldo mentor baseado em R$ 6.000 fixo | Alta | **Corrigido** |
| Orçamentos `pendente` não apareciam nas prioridades | Média | **Corrigido** |
| `getExecutiveReport` referenciava `ctx` indefinido | Alta | **Corrigido** |
| Nome “Anderson” fixo na UI | Baixa | **Corrigido** (usa perfil) |
| `JSON.parse` sem try na análise de relatórios | Média | **Corrigido** |

---

## 5. Erros silenciosos

| Tipo | Situação |
|------|----------|
| `console.error` / `warn` em APIs | Esperado para logs server-side; usuário recebe JSON `{ error }` |
| Hydration | Sem `suppressHydrationWarning` abusivo; datas formatadas no client podem divergir em edge cases |
| Auth | Sessão expirada retorna mensagem em CRUD offline |
| Supabase tabela ausente | `isMissingSupabaseTableError` + empty states nos módulos |

---

## 6. Mobile

| Área | Status |
|------|--------|
| Sidebar | `MobileSidebar` + menu no header |
| Modais | `min-h-11` em botões críticos |
| Formulários | Inputs com altura tátil |
| Busca global | Segunda linha no header em mobile |
| Safe area | `env(safe-area-inset-*)` no shell |

---

## 7. Performance

| Ponto | Impacto | Sugestão (pós-v1) |
|-------|---------|-------------------|
| Dashboard: 10 hooks CRUD paralelos | Alto no primeiro paint | Contexto de dados compartilhado ou RSC |
| Aura Central + Relatórios + Feed | 3+ fetches na home | Unificar resumo diário em um endpoint |
| Financeiro `syncGoalsProgress` | N+1 queries por meta | RPC ou query agregada |
| Global search | 13 queries paralelas (6/ tabela) | Aceitável com debounce 280ms |

---

## 8. Melhorias sugeridas (sem implementar agora)

1. Endpoint único `/api/dashboard-bootstrap` para a home.
2. Overview dinâmico na sidebar a partir dos mesmos hooks.
3. PDF de relatórios e propostas no mesmo pipeline Storage.
4. Testes Playwright para fluxos críticos (login, CRUD lead, busca).
5. Reduzir duplicação Aura Central ↔ painel Relatórios no diário.

---

## Comandos de validação

```bash
npm test
npm run build
```

Migrations críticas: `supabase/migrations/` (growth, financial, alvesz_propostas, alvesz-pdfs, notifications).
