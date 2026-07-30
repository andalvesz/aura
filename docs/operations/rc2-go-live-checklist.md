# RC2.1 Go-Live Checklist — Aura Brain colaborativo

| Campo | Valor |
|-------|-------|
| Fase | RC2.1 |
| Objetivo | Dois usuários no mesmo workspace, uso diário seguro |
| Fora de escopo | Decision Support · Planner inteligente · Automações · Execution |

Use este checklist **manualmente**. Não aplique migrations automaticamente em produção.

---

## 1. Migrations

- [ ] Backup do projeto Supabase disponível
- [ ] Revisar `supabase/migrations/20260729120000_discovery_engine_v1.sql`
- [ ] Revisar `supabase/migrations/20260729140000_rc2_1_collaborative_go_live.sql`
- [ ] Aplicar Identity → Memory → World → Cognitive (se ainda não aplicadas)
- [ ] Aplicar Discovery V1
- [ ] Aplicar RC2.1 collaborative go-live
- [ ] Confirmar tabelas: `aura_identity_*`, `aura_experiences`, `aura_memories`, `aura_world_*`, `aura_cognitive_*`, `aura_discovery_*`
- [ ] Confirmar coluna `visibility_scope` e `row_version` em discovery artifacts
- [ ] Confirmar função `aura_brain_visibility_readable`

### Aplicação manual (exemplo)

```bash
# Staging primeiro
npx supabase db push --dry-run
# Após revisão:
npx supabase db push
```

**Rollback lógico:** desativar UI Discovery / reverter feature flags; dados permanecem; policies podem ser restauradas via migration inversa documentada no report.

---

## 2. DB types

- [ ] Regenerar tipos oficiais:

```bash
npx supabase gen types typescript --project-id <PROJECT_ID> --schema public > types/database.generated.ts
```

- [ ] Mesclar tabelas Brain em `types/database.ts` (já há `types/aura-brain-database.ts` + `AuraBrainTables`)
- [ ] Remover adapters `LooseClient` restantes nos engines quando o client tipado cobrir as tabelas
- [ ] `npm run typecheck` passa
- [ ] `npm run build` passa

---

## 3. Variáveis de ambiente

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (somente server / scripts)
- [ ] Sem secrets em logs de Discovery runs

---

## 4. Workspace colaborativo

- [ ] Workspace criado (ou selecionado)
- [ ] Segundo usuário convidado (sem hardcode de e-mail no código)
- [ ] Convite aceito em `/convite/[token]`
- [ ] Papéis: owner / admin / member
- [ ] Membro ativo vê dados `WORKSPACE`
- [ ] Membro removido perde acesso
- [ ] Troca Personal ↔ Workspace funciona
- [ ] Isolamento entre dois workspaces validado

---

## 5. Política de visibilidade

- [ ] Defaults documentados em `docs/architecture/visibility-policy.md`
- [ ] Memória privada não aparece para colaborador
- [ ] Memória compartilhada (`WORKSPACE` + ato explícito) alimenta pipeline
- [ ] `SHARED_WITH_SELECTED_MEMBERS` não usado (fail closed → PRIVATE)
- [ ] Discovery `executionInfluence` permanece `"none"`

---

## 6. Fluxo end-to-end

- [ ] Usuário A registra memória compartilhada
- [ ] Persistência Memory OK
- [ ] Promotion avaliada
- [ ] World Model atualizado
- [ ] Cognitive gera artefatos elegíveis
- [ ] Discovery gera sinais (`Atualizar descobertas`)
- [ ] Usuário B visualiza descoberta
- [ ] Usuário B confirma / rejeita / arquiva / silencia
- [ ] Usuário A vê feedback e histórico
- [ ] Nenhuma ação operacional executada

---

## 7. Produto

- [ ] Onboarding Aura Brain visível
- [ ] Estados vazios com ação inicial (Meu Dia, Memórias, Mapa, Insights, Descobertas, Timeline, Busca)
- [ ] Botão Atualizar descobertas: loading, anti-duplo clique, mensagens, correlationId
- [ ] Meu Dia: descobertas recentes, risco, oportunidade, pendentes, memórias — linguagem de indício
- [ ] Busca respeita visibilidade
- [ ] Timeline mostra ator / camada / origem / data / workspace
- [ ] Mobile smoke (viewport estreito)

---

## 8. Segurança / RLS

- [ ] Owner lê próprio
- [ ] Membro lê WORKSPACE
- [ ] Não-membro não lê
- [ ] Removido perde acesso
- [ ] Feedback de outro membro não é reescrito sem permissão / conflito de versão
- [ ] `workspaceId` não manipulável para vazar dados
- [ ] IDs enumeráveis não concedem acesso
- [ ] Suppression não atravessa workspace
- [ ] Brain não recebe PRIVATE de outro usuário

---

## 9. Observabilidade

- [ ] Runs em `aura_discovery_runs` (duração, gerados, dedupe, suppressed)
- [ ] Sem conteúdo completo de memória / prompts / secrets nos reports
- [ ] correlationId nas mensagens de bootstrap

---

## 10. Testes locais

```bash
npm run test:identity
npm run test:memory
npm run test:world
npm run test:cognitive
npm run test:discovery
npm run test:rc1
npm run test:go-live
npm run typecheck
npm run build
```

- [ ] Todas as suítes acima PASS

---

## 11. Backup e go-live

- [ ] Backup disponível
- [ ] Logs verificados (sem PII sensível)
- [ ] Checklist assinado por operador
- [ ] Comunicação aos dois usuários: “Aura não executa decisões”

---

## Definition of Done (RC2.1)

Ver `reports/rc2.1-go-live-collaboration.md` §19.

**Não iniciar Sprint 7.0 / Decision Support nesta fase.**
