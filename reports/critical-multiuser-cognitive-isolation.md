# Critical Incident Report — Multiuser Cognitive Isolation

**Date:** 2026-07-31  
**Severity:** CRITICAL (security / privacy)  
**Status final:** **SAFE_WITH_MANUAL_DATA_REVIEW**

---

## 1. Resumo executivo

Um segundo usuário autenticado recebia contexto pessoal do Anderson (incluindo lesão no ombro) ao pedir treino. A causa raiz principal **não** foi RLS quebrada nem troca de `auth.uid()`: foi **hardcode de perfil médico/pessoal nos prompts** (system context da Aura Saúde / Health Coach e superfícies adjacentes), injetado para **qualquer** usuário autenticado.

Correção aplicada: isolamento obrigatório no context object server-side, remoção dos hardcodes pessoais de saúde, prompts genéricos com intake quando perfil vazio, Memory Brain com blocos `personalMemories` / `workspaceMemories`, reset de estado client no logout, desativação do seed automático de legado Anderson, auditoria estática + testes críticos.

## 2. Severidade

**CRITICAL** — vazamento de dados de saúde / identidade cognitiva entre contas.

## 3. Reprodução

1. Usuário A (Anderson) possui contexto de lesão no ombro (e/ou hardcode histórico no prompt).
2. Usuário B (sócio) entra com conta própria, mesmo dispositivo ou outro.
3. B envia: “Monte um treino para mim.” (ou quick action “Treino de hoje”).
4. **Antes:** resposta mencionava lesão/ombro do Anderson.
5. **Depois:** prompt de sistema não contém lesão de terceiros; com perfil vazio, instrui a perguntar metas/restrições.

## 4. Causa raiz

Camada de **prompt / bootstrap cognitivo**, não primariamente banco:

| Camada | Problema |
|--------|----------|
| `utils/health.ts` `HEALTH_COACH_CONTEXT` | Perfil Anderson + “lesão no ombro direito” hardcoded |
| `app/api/health-coach/route.ts` | `ACTION_DEFAULTS` e instrução “Evite exercícios que sobrecarreguem o ombro direito lesionado” |
| `app/api/aura-central` / `utils/orchestrator.ts` | Contexto permanente Anderson + ombro |
| Mentor / Social / Coach / Instagram themes | Perfil pessoal hardcoded reutilizado como “o usuário” |
| `seedLegacyForUser` | Podia copiar biografia Anderson para conta vazia |

## 5. Caminho do vazamento

```
User B → POST /api/health-coach (mode=treino)
  → buildSystemPrompt(HEALTH_COACH_CONTEXT + dados B)
  → HEALTH_COACH_CONTEXT continha lesão do Anderson (sempre)
  → system message adicional: “ombro direito lesionado”
  → OpenAI gera treino citando restrição de A
```

Dados reais do Supabase de B podiam estar vazios; o hardcode preenchia o vazio com a biografia de A.

## 6. Camadas afetadas

- Health / Workout / Diet prompts
- Aura Central / Orchestrator context
- Aura Mentor / Aura IA / Social IA
- Coach personality / displayName defaults
- Identity hints (subject + hash)
- Memory Brain context shape
- Client logout state
- Legado seed
- Instagram brand themes (ombro)

## 7. Arquivos corrigidos (principais)

- `lib/context/resolved-user-context.ts` *(novo)*
- `lib/client/session-reset.ts` *(novo)*
- `lib/supabase/services/context.ts`
- `lib/supabase/services/health-coach.service.ts`
- `lib/supabase/services/identity-engine.service.ts`
- `lib/supabase/services/legado.service.ts`
- `lib/supabase/services/memory.service.ts`
- `lib/memory/engine.ts` / `lib/memory/types.ts`
- `utils/health.ts`
- `utils/orchestrator.ts`
- `utils/coach.ts`
- `utils/social.ts`
- `utils/instagram.ts`
- `app/api/health-coach/route.ts`
- `app/api/aura-central/route.ts`
- `app/api/aura/route.ts`
- `app/api/aura-mentor/route.ts`
- `app/api/social-ia/route.ts`
- `components/dashboard/modules/aura-saude.tsx`
- `components/dashboard/dashboard-header-toolbar.tsx`
- `utils/multiuser-isolation.test.ts` *(novo)*
- `scripts/audit-multiuser-context.mjs` *(novo)*
- `e2e/multiuser-isolation.spec.ts` *(novo)*
- `supabase/migrations/20260731200000_multiuser_cognitive_isolation_corrective.sql` *(não auto-aplicar)*

## 8. Cache

- Identity / Memory / Cognitive / World já usavam chaves `userId::workspace::…`
- Adicionado `personalCacheNamespace()` para features pessoais
- Health coach loga `cache_namespace` estruturado
- Proibido padrão `aura:health` global (detector no audit)

## 9. Stores

- Stores de Identity/Memory/Learning já namespaced por `userId`
- `globalThis.__AURA_AUDIT_CTX__` permanece **somente** para scripts de certificação; agora normaliza `resolved` se ausente
- **WARN** permanente: não usar esse global em request HTTP real

## 10. Health / Workout / Diet

- Contexto genérico + isolamento explícito
- Sem assunção de lesão
- Intake obrigatório quando perfil vazio
- `assertPersonalSubject` na rota e no service
- Bloqueio se prompt ainda contiver hardcode de lesão estrangeira

## 11. Identity

- `getIdentityHintsForBrain` exige `assertPersonalSubject`
- Retorna `subjectUserId` + `resolvedForUserIdHash` (hash curto)

## 12. Memory

- `getMemoryContextForBrainPure` retorna `personalMemories` e `workspaceMemories` separados
- `meta.subjectUserId` explícito
- Isolamento user A vs B coberto por teste

## 13. World Model

- Sem alteração estrutural nesta correção; caches já namespaced
- Auditoria de entidades fundidas: **revisão manual recomendada** em produção

## 14. Orchestrator

- `AURA_CENTRAL_CONTEXT` genérico (usuário autenticado)
- Instrução de saúde sem lesão hardcoded

## 15. Conversation

- Resolver existente já filtra por viewer; nova conversa continua ligada a `getDataContext().userId`
- Logout limpa sessionStorage / prefixes aura client-side

## 16. Client state

- `clearClientPersonalState` no submit de logout
- Offline queue **não** apaga namespace de outro usuário

## 17. Offline / PWA

- Offline storage já era `aura-offline:vN:userId:…`
- Reset client preserva filas de outras contas

## 18. RLS

- Migration corretiva **documental** criada; **não aplicada automaticamente**
- Reafirma padrão own-row em health_* — aplicar após revisão DBA

## 19. Migration

Arquivo: `supabase/migrations/20260731200000_multiuser_cognitive_isolation_corrective.sql`  
Status: **manual review only**

## 20. Auditoria de dados existentes

- `npm run audit:multiuser-context` → **PASS** (0 critical, 1 warn sobre `__AURA_AUDIT_CTX__`)
- Relatório JSON: `reports/multiuser-context-audit.json`
- Dados legados já gravados com biografia Anderson em contas erradas: **revisão manual**

## 21. Testes

```
npm run test:multiuser-isolation  → 14/14 PASS
npm run typecheck                 → PASS
utils/memory-engine / coach / orchestrator → PASS
```

Incluído em `test:security`.

## 22. E2E

- `e2e/multiuser-isolation.spec.ts` criado
- Requer `E2E_USER_A_EMAIL/PASSWORD` e `E2E_USER_B_EMAIL/PASSWORD`
- Skip automático sem credenciais

## 23. Limitações

- Alguns módulos de marca (Instagram `marca_pessoal` label “Anderson Alves”) ainda refletem catálogo de produto Alvesz — não injetam saúde no Health Coach, mas devem migrar para branding por workspace/usuário
- World Model merge audit completo depende de dados em produção
- E2E real de duas contas depende de secrets locais
- `__AURA_AUDIT_CTX__` global ainda existe para certificação

## 24. Dados que precisam de revisão manual

1. Contas que rodaram `seedLegacyForUser` / import Anderson sem serem o Anderson
2. Claims Identity / memórias de saúde com conteúdo de ombro em `user_id` ≠ Anderson
3. Conversas AI `saude` antigas contendo lesão (histórico de prompt)
4. Aplicar migration RLS health_* após probes `user_id is null`

## 25. Prontidão para uso multiusuário

**Pronto para uso multiusuário no fluxo Saúde/Treino/Dieta e prompts centrais**, com ressalva de revisão manual de dados legados e branding Alvesz.

## 26. Status final

### SAFE_WITH_MANUAL_DATA_REVIEW

Não declarado **SAFE** absoluto enquanto:

- existirem possíveis rows legadas contaminadas;
- E2E autenticado de duas contas não tiver sido executado no ambiente real;
- migration RLS corretiva não tiver sido aplicada/validada em produção.

---

## 27. Follow-up pós-auditoria (mesma correção)

A auditoria read-only ([Audit multiuser context leaks](6c0ab437-4805-4273-bbd8-ce3bded5359e)) confirmou a causa raiz e listou resíduos. Itens adicionais fechados nesta rodada:

- `utils/english.ts` — ENGLISH_COACH_CONTEXT genérico
- `utils/legado.ts` — LEGACY_AI_CONTEXT + header de contexto genéricos
- Fallbacks `"Anderson"` → `"você"` (aura-central, execution, executive, notifications, daily-operations)
- Saudações UI sem nome hardcoded (Saúde, English, Mentor, Chat, Calendário)
- Auto-seed + botão “Importar trajetória Anderson Alves” removidos do LegadoView
- Cron automations: allowlist opcional `CRON_AUTOMATION_USER_ALLOWLIST`
- Offline sync: update/delete/refresh com `.eq("user_id", userId)`
- reports.service prompt sem “Anderson Alves”
- Instagram marca pessoal description genérica

Resíduos intencionais / baixa prioridade (branding Alvesz comercial, fixtures de teste):
- Assinaturas comerciais (proposta, follow-up WhatsApp) ainda podem citar Alvesz Experience — escopo WORKSPACE/marca, não saúde
- `buildAndersonLegacySeed` permanece no código como fixture histórica, mas **não** é mais aplicada automaticamente

| Critério | Status |
|----------|--------|
| B não recebe dados pessoais de A via health prompt | ✔ |
| Saúde/treino/dieta estritamente pessoais | ✔ |
| Identity hints com subject + hash | ✔ |
| Memory personal/workspace separados | ✔ |
| Orchestrator sem hardcode de lesão | ✔ |
| Cache namespaced / audit | ✔ |
| Logout limpa client state | ✔ |
| Offline queue isolada (preservada) | ✔ |
| Bootstrap legado Anderson desativado | ✔ |
| `test:multiuser-isolation` PASS | ✔ |
| Typecheck PASS | ✔ |
| Audit static PASS | ✔ |
| E2E spec presente (creds opcionais) | ✔ |
| Build | ✔ PASS |
