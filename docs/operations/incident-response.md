# Incident response (beta)

## Severidade

1. Auth / RLS / data leak — imediato: maintenance global + flag rollback
2. Provider / automação / agente — pausar capability / maintenance por capability
3. UI / confusão — feedback triage + known issue no changelog

## Passos

1. Capturar **correlationId** do usuário (erro UI / diagnóstico)
2. Abrir Error Inbox (`/dashboard/admin/errors`) — agrupado, sem stack sensível
3. Classificar: produto vs bloqueio de segurança esperado
4. Mitigar: flag 0%, release rollback lógico, maintenance, suspender beta access
5. Comunicar via announcement interno (sem e-mail externo nesta sprint)
6. Registrar em `aura_platform_audit` / ops audit

## Support Mode

Usar support view (status, flags, erros, consents). **Proibido** impersonar ou ler memórias/documentos/conversas.

## Contatos internos

Definir canal da equipe fora do produto (Slack/etc.) — não coberto pelo app nesta sprint.
