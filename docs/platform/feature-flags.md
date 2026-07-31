# Feature Flags

Escopos: `system` · `user` · `workspace` · `capability` · `environment`

Precedência (mais específico vence): capability → user → workspace → environment → system

Ausência de flag = permitido (liberação gradual, não auth).

**Não usar feature flags como substituto de autorização.**

Overrides enviados pelo cliente são ignorados (`rejectClientFlagOverride`).
