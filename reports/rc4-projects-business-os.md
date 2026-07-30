# RC4 — Projects & Business OS

| Campo | Valor |
|-------|-------|
| Data | 2026-07-29 |
| Status | **DELIVERED** |
| Baseline | RC3.1 Mobile & Smart Capture |
| Escopo | Projetos, Business Hub, colaboração, documentos, timeline |
| Fora de escopo | Decision Support · Execution · alteração do Kernel Cognitivo · RC4.1 |

---

## 1. Resumo executivo

A RC4 transforma o Aura Brain em **sistema operacional de projetos e empresas**: ideia vira projeto; cada projeto centraliza memórias, documentos, discovery, entidades (via world/navegação), comentários, timeline e arquivos — com Business Hub (Empresa → Projetos → Memórias → Discovery → Documentos), kanban com drag-and-drop, papéis Owner/Editor/Viewer e `executionInfluence: "none"`.

---

## 2. Projetos

| Capacidade | Rota / módulo | Status |
|------------|---------------|--------|
| Lista + criação | `/dashboard/projects` | ✅ |
| Detalhe (abas) | `/dashboard/projects/:id` | ✅ |
| Kanban por status + DnD | `ProjectsKanban` | ✅ |
| Documentos | `/dashboard/projects/:id/documents` | ✅ |
| Memórias 0..1 projeto | `linkMemoryToProject` | ✅ |
| Timeline exclusiva | store + UI | ✅ |
| Discovery filtrado | `filterDiscoveriesForProject` | ✅ |
| Comentários | `CommentTargetType` + `project`/`document` | ✅ |
| Favoritos | toggle + home widgets | ✅ |
| Membros Owner/Editor/Viewer | engine + RLS migration | ✅ |

Campos: id, nome, descrição, status, workspace, owner, membros, tags, cor, ícone, favorito, arquivado, businessId, memoryIds, createdAt, updatedAt.

---

## 3. Business Hub

| Capacidade | Status |
|------------|--------|
| `/dashboard/business` | ✅ |
| Empresa: nome, segmento, descrição | ✅ |
| Projetos relacionados | ✅ |
| Relação Empresa → Projetos → … | ✅ |

---

## 4. Colaboração

- Papéis: **owner** · **editor** · **viewer**
- Gates `canEditProject` / `canViewProject`
- Migration RLS: `aura_projects`, `aura_project_members`, `aura_project_documents`, `aura_project_timeline`, `aura_businesses`
- Comentários em projeto (e documento via tipo)

---

## 5. Busca & Home

- Global search: `aura_projects`, `aura_businesses` (+ docs de projeto)
- Meu Dia: widgets **ativos / recentes / favoritos**
- Nav Aura Brain: Projetos + Business Hub

---

## 6. Performance

- Paginação (`limit` / `offset`) nas listagens
- Lazy loading de abas no detalhe (client tabs)
- Cache in-memory por user/workspace (padrão RC3)
- Discovery filtrado sem regenerar o kernel

---

## 7. Testes

| Suite | Resultado |
|-------|-----------|
| `npm run test:projects` | **PASS** (13) |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** (confirmação na entrega) |

Cobertura: projetos, membros/RLS, comentários, timeline, documentos, discovery, business, paginação, `executionInfluence: none`.

---

## 8. Pendências

- Persistência Supabase (store in-memory + migration pronta — aplicar SQL)
- Entidades world-model auto-projetadas a partir do projeto (navegação manual via discovery/memory hoje)
- Convite de membro por e-mail (hoje por user id)
- Storage bucket dedicado a documentos de projeto
- E2E Playwright do kanban

---

## 9. Prontidão para RC4.1

**Parcial.** Projects & Business OS utilizável. RC4.1 pode focar persistência DB completa, world projector de projeto e convites.

**Não iniciar RC4.1 nesta entrega.** Gate: sem Decision Support / Execution; `executionInfluence: "none"`.

---

## Definition of Done

| Critério | Status |
|----------|--------|
| Projetos funcionais | ✅ |
| Business Hub funcional | ✅ |
| Timeline por projeto | ✅ |
| Discovery integrado | ✅ |
| Documentos integrados | ✅ |
| Busca integrada | ✅ |
| Colaboração funcionando | ✅ |
| Kanban funcional | ✅ |
| Testes PASS | ✅ |
| Typecheck PASS | ✅ |
| Build PASS | ✅ |
| `executionInfluence` permanece `"none"` | ✅ |
| Decision Support / Execution / Kernel intactos | ✅ |
