# Política de Visibilidade — Aura Brain (RC2.1)

| Campo | Valor |
|-------|-------|
| Status | Active |
| ADRs | ADR-007 Privacy & Ownership |
| Escopo | Identity · Memory · World · Cognitive · Discovery |

## Escopos

| Escopo | Quem lê | Quando usar |
|--------|---------|-------------|
| `PRIVATE` | Somente o dono | Default seguro para quase tudo |
| `WORKSPACE` | Membros ativos do workspace | Somente com ato explícito de compartilhar |
| `SHARED_WITH_SELECTED_MEMBERS` | Lista de membros | **Não suportado na RC2.1** — resolvido para `PRIVATE` |
| `SYSTEM_INTERNAL` | Dono / operadores sob política | Auditoria técnica mínima |

## Defaults por recurso

| Recurso | Default |
|---------|---------|
| Memory | `PRIVATE` |
| World Entity | `PRIVATE` |
| World Relationship | `PRIVATE` |
| Cognitive Artifact | `PRIVATE` |
| Discovery Artifact | `PRIVATE` (vira `WORKSPACE` se criado no contexto workspace **com** `shareWithWorkspace`) |
| Feedback | herda o escopo do artefato / `PRIVATE` |
| Suppression | herda o escopo do artefato / `PRIVATE` |
| Timeline | filtra por visibilidade do item de origem |
| Identity Claim | `PRIVATE` (nunca projetado automaticamente) |
| Run / métricas | `PRIVATE` |
| Audit | `SYSTEM_INTERNAL` (leitura colaborativa só de eventos de workspace) |

## Regras

1. Membership sozinho **não** torna dados privados visíveis ao workspace.
2. Compartilhar exige `shareWithWorkspace: true` **ou** `visibilityScope` / `consentScope` explícito.
3. Quando o escopo não puder ser determinado com segurança → `PRIVATE`.
4. `SHARED_WITH_SELECTED_MEMBERS` sem ACL real → `PRIVATE`.
5. Dados `PRIVATE` de outro usuário **nunca** entram no Brain context de um colaborador.
6. Suppression **não** atravessa workspaces.
7. Confirmar uma descoberta **não** a transforma em fato operacional (`executionInfluence` permanece `"none"`).

## Implementação

- Código: `lib/aura-brain/visibility.ts`
- Migration: `supabase/migrations/20260729140000_rc2_1_collaborative_go_live.sql`
- Função RLS: `aura_brain_visibility_readable(user_id, workspace_id, visibility_scope)`
