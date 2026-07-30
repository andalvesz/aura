# RC4.1 — Documents & Knowledge Hub

| Campo | Valor |
|-------|-------|
| Data | 2026-07-29 |
| Status | **DELIVERED** |
| Baseline | RC4 Projects & Business OS |
| Escopo | Knowledge Hub, documentos, OCR, notas, versionamento, busca, coleções, exportação |
| Fora de escopo | Decision Support · Execution · alteração do Kernel Cognitivo · Sprint 7.0 |

---

## 1. Resumo executivo

A RC4.1 transforma o Aura Brain em **repositório inteligente de conhecimento**: todo documento (nota, PDF, imagem, link, arquivo, contrato) passa a fazer parte do workspace, com OCR indexado, versionamento, comentários, coleções e busca unificada — alimentando Memory / World / Cognitive / Discovery **sem** criar decisões automáticas. `executionInfluence` permanece `"none"`.

---

## 2. Knowledge Hub

| Capacidade | Rota / módulo | Status |
|------------|---------------|--------|
| Hub central | `/dashboard/knowledge` | ✅ |
| Document view | `/dashboard/knowledge/:id` | ✅ |
| Legacy Connect | `/dashboard/knowledge/connect` | ✅ (preservado) |
| Nav Aura Brain | Knowledge Hub | ✅ |
| Tabs: tudo / notas / links / arquivos / favoritos / arquivados / coleções | UI | ✅ |

Centraliza: documentos, notas, links, arquivos, anexos e pesquisa.

---

## 3. Documentos

Campos: id, título, descrição, tipo, workspace, projeto, empresa, tags, autor, visibility, createdAt, updatedAt — mais conteúdo, OCR, preview, versões e coleções.

Tipos: `note` · `pdf` · `image` · `link` · `file` · `audio` · `contract`.

---

## 4. Document View

Mostra: resumo, preview (incl. link permanente), timeline de atividade, comentários (reply/edit/delete), memórias / discovery / projetos / empresas / entidades relacionadas, OCR com reprocessamento, exportação e versionamento.

---

## 5. OCR

- PDF/imagem/contrato iniciam com `ocrStatus: pending`
- Indexação via `applyOcrPure` → `searchableText` + índice incremental
- Reprocessar OCR na UI
- Status: none / pending / processing / ready / failed / manual

---

## 6. Links

Preview permanente (`LinkPreview`: título, descrição, imagem, origem/url, fetchedAt).

---

## 7. Notas

Editor Markdown simples com autosave (softSave) e checkpoint de versão no histórico.

---

## 8. Versionamento

Versões com autor, data e nota; restaurar; comparar campos (title/description/content/ocrText). Restauração só pelo autor (gate de edição).

---

## 9. Relacionamentos

Vínculos: project · business · memory · entity · discovery.

---

## 10. Busca

Índice incremental cobre OCR, notas, documentos, links, comentários e tags. Integrada ao Global Search (`aura_knowledge`).

---

## 11. Coleções

Coleções e pastas; favoritos e arquivados no hub.

---

## 12. Comentários

Por documento: responder (parentId), editar, excluir (soft), histórico de edições.

---

## 13. Atividade

Registra: upload · edição/versão · comentário · OCR · restauração · link · coleção · export (via UI).

---

## 14. Home

Widgets: Documentos recentes · Notas recentes · Conhecimento atualizado.

---

## 15. Business

Empresas listam documentos, contratos, arquivos e links do Knowledge Hub.

---

## 16. Projects

Aba Documentos mostra documentação completa (Knowledge + anexos de projeto).

---

## 17. Exportação

Markdown · PDF (payload textual) · JSON — todos com `executionInfluence: "none"`.

---

## 18. Performance

- Paginação (`limit` / `offset`)
- Lazy loading de abas/relações no document view
- Indexação incremental por documento
- Cache stamp `listUpdatedAt` no store

---

## 19. Segurança

- Visibility PRIVATE / WORKSPACE (fail closed)
- Gates `canViewDocument` / `canEditDocument`
- Migration RLS: `supabase/migrations/20260729220000_rc4_1_knowledge_hub.sql`
- Versionamento apenas pelo autor
- Runtime ainda in-memory (padrão RC3/RC4); SQL preparado

---

## 20. Testes

| Suite | Resultado |
|-------|-----------|
| `npm run test:knowledge` | **PASS** (13) |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** |

Cobertura: documentos, OCR, notas, versionamento, comentários, busca, coleções, projetos, business, workspace/RLS mirrors, export, `executionInfluence: none`.

---

## 21. Pendências

- Persistência Supabase wired (store in-memory + migration pronta)
- Storage bucket real para binários (hoje metadados + OCR/texto)
- Cascade automática documento → Memory/World/Cognitive/Discovery (vínculos manuais na RC4.1)
- E2E Playwright do Knowledge Hub
- OCR Vision automático no create via upload multipart (reusa APIs Smart Capture existentes)

---

## 22. Prontidão para Sprint 7.0

**Parcial / pronta como baseline de conhecimento.** Knowledge Hub utilizável. Sprint 7.0 **não iniciada**.

Gate: sem Decision Support / Execution; Kernel Cognitivo intocado; `executionInfluence: "none"`.

---

## Definition of Done

| Critério | Status |
|----------|--------|
| Knowledge Hub funcional | ✅ |
| Documentos completos | ✅ |
| OCR indexado | ✅ |
| Notas Markdown | ✅ |
| Versionamento | ✅ |
| Busca integrada | ✅ |
| Coleções | ✅ |
| Exportação | ✅ |
| Testes PASS | ✅ |
| Typecheck PASS | ✅ |
| Build PASS | ✅ |
| `executionInfluence` permanece `"none"` | ✅ |
| Sprint 7.0 não iniciada | ✅ |
