# E2E — configuração

Para testes autenticados Playwright:

1. Copie `.env.e2e.example` (se existir) ou crie `.env.e2e` local.
2. Defina:
   - `E2E_OWNER_EMAIL`
   - `E2E_OWNER_PASSWORD`
3. **Nunca** commit `.env.e2e` (já coberto pelo `.gitignore` tipicamente).

Sem essas variáveis, specs autenticados são **skipped** de forma justificada; smoke/identidade públicos continuam rodando.
