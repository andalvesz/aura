# RC3.1 — Mobile & Smart Capture

| Campo | Valor |
|-------|-------|
| Data | 2026-07-29 |
| Status | **DELIVERED** |
| Baseline | RC3 Daily Operations |
| Escopo | Captura universal rápida (&lt;10s), OCR, anexos, offline, mobile |
| Fora de escopo | Decision Support · Execution · alteração do Kernel Cognitivo · RC4 |

---

## 1. Resumo executivo

A RC3.1 transforma o Aura Brain em ferramenta de **captura em qualquer lugar**: Smart Capture unificado (texto, imagem, PDF, áudio, link, vídeo), OCR editável, preview, fila offline, sincronização, biblioteca de anexos pesquisável e polish mobile — com cascade automática Memory→Promotion→World→Cognitive→Discovery e `executionInfluence: "none"`.

---

## 2. Captura

| Capacidade | Implementação | Status |
|------------|---------------|--------|
| Smart Capture (tela única) | FAB + modal `SmartCapture` | ✅ |
| Texto / imagem / PDF / áudio / link / vídeo | Upload + links + OCR | ✅ |
| Cascade automática + progresso visual | `cascade-progress` + painel UI | ✅ |
| Drag and drop global | `GlobalDropCapture` | ✅ |
| Share Mode (estrutura) | `POST/GET /api/share` + `manifest.share_target` | ✅ |
| Tags sugeridas (opcionais) | `suggestTags` + aceite manual | ✅ |
| Fixar Home / Busca / Feed | `pins` em favoritos | ✅ |

---

## 3. OCR

- PDF via `pdf-parse`
- Imagem via OpenAI Vision (se `OPENAI_API_KEY`) ou provider injetável
- Texto UTF-8 para `.txt`/`.md`
- Edição obrigatoriamente permitida antes de salvar (`ocr-edit`)
- Memória inclui arquivo + texto OCR + metadados

---

## 4. Offline & Sincronização

- Fila local (`lib/smart-capture/offline-queue.ts`)
- Flush automático ao voltar online (`SmartCaptureOfflineSync`)
- Painel **Sincronizações**: pendentes / enviadas / falhas / última sync
- Rota: `/dashboard/settings/sync`

---

## 5. Uploads

- Validação de tipo e tamanho
- Barra de progresso, ETA, cancelar, reenviar, erro
- Compressão de imagens no cliente
- Upload paralelo (concurrency 3)
- Virus scan: estrutura preparada (`provider: prepared`)

---

## 6. Performance

- Compactação de imagens (canvas)
- Lazy loading em previews (`loading="lazy"`)
- Cache de fila/lastSync em `localStorage`
- Upload paralelo
- Cascade limitada (herdada RC3, `maxArtifacts: 12`)

---

## 7. Busca & Anexos

- Biblioteca `/dashboard/attachments`
- Busca por OCR, links, nome de arquivo, tags
- Integração na busca global (`aura_attachments`)
- Preview: imagem, PDF, link, áudio

---

## 8. Segurança

| Controle | Status |
|----------|--------|
| Tipo de arquivo | ✅ allowlist MIME/ext |
| Tamanho | ✅ 12–25 MB |
| Vírus | ✅ estrutura preparada |
| Workspace / share | ✅ validação |
| RLS migration | ✅ `aura_memory_attachments` |

Migration: `supabase/migrations/20260729180000_rc3_1_smart_capture.sql` (aplicar manualmente no Supabase).

---

## 9. Testes

| Suite | Resultado |
|-------|-----------|
| `npm run test:mobile` | **PASS** (23) |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS** |

Cobertura: Quick Capture cascade, OCR, Links, Upload, Offline Queue, Sync, Busca, Preview, Anexos, Workspace/RLS, Mobile helpers, `executionInfluence: none`.

---

## 10. Pendências

- Persistência DB dos anexos (store in-memory + migration pronta; wiring Supabase Storage bucket)
- Scanner antivirus real (hook `prepared`)
- Service Worker completo para Share Target em produção PWA
- OCR de imagem sem API key (provider local opcional futuro)
- E2E Playwright dedicado a Smart Capture mobile

---

## 11. Prontidão para RC4

**Concluída em entrega separada.** Ver `reports/rc4-projects-business-os.md`.

**Não iniciar RC4.1 nesta linha.**

---

## Definition of Done

| Critério | Status |
|----------|--------|
| Smart Capture funcional | ✅ |
| OCR funcionando | ✅ |
| Upload de arquivos | ✅ |
| Preview funcionando | ✅ |
| Offline Queue funcional | ✅ |
| Sincronização funcional | ✅ |
| Busca encontra anexos | ✅ |
| Mobile responsivo | ✅ |
| Testes verdes (`test:mobile`) | ✅ |
| Typecheck PASS | ✅ |
| Build PASS | ✅ |
| `executionInfluence` continua `"none"` | ✅ |
| Decision Support / Execution / Kernel intactos | ✅ |
