# Aura Brain — Security Model

## Princípios

1. Intelligence Engine é **determinístico** (sem LLM).
2. LLM **nunca** executa ações irreversíveis.
3. Toda execução passa por Action Registry + permissions + autonomia.
4. Contexto (`userId`, `workspaceId`) resolvido **no servidor**.
5. Sem autonomia irrestrita.

## Níveis de autonomia

| Nível | Comportamento |
|-------|---------------|
| SUGGEST | Só recomenda |
| PREPARE | Rascunhos |
| CONFIRM | Exige OK explícito |
| AUTO_SAFE | Só risco **LOW** + usuário habilitou |

## Bloqueios permanentes (mesmo em AUTO_SAFE)

- Financeiro final → confirmação
- Comunicação externa → confirmação
- Exclusão → confirmação
- Mudança de permissão → confirmação
- Risco HIGH/CRITICAL → nunca automático

## Isolamento

- PERSONAL: `user_id`
- WORKSPACE: membership validada
- Sem cross-workspace
- Memory providers filtram por user/workspace

## Auditoria

- `aura_brain_audit_logs` (+ buffer in-memory)
- Input sanitizado (password/token/secret/api_key redacted)
- Sem senhas, tokens, cartões

## Automações

- Cooldown
- Max executions/day
- Idempotência (`dedupeKey` / notified set)
- Desligáveis por settings

## Notificações

- Reuso de `notifications` (interna)
- Sem e-mail / WhatsApp / push externo nesta sprint
