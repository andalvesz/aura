# Support Mode

Modo de suporte para admins da plataforma (**allowlist**).

## Pode ver

- Status da conta / beta
- Onboarding (passo/conclusão)
- Capabilities e skills instaladas (ids)
- Feature flags
- Erros recentes + correlationIds
- Migrations detectadas
- Health resumido
- Consentimentos de analytics

## Não pode

- Impersonar usuário
- Ler memórias, documentos, conversas
- Dados financeiros / conteúdo privado
- Tokens / senhas / prompts

## API

`buildSupportView` / `getSupportViewAction` — retorna `note: support_mode_no_impersonation_no_private_content`.

`impersonateUserAction` existe apenas para negar (`impersonation_forbidden`).
