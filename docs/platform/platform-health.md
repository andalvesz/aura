# Platform Health

`buildPlatformHealth()` → estados `HEALTHY` | `DEGRADED` | `UNAVAILABLE` | `UNKNOWN`

Componentes: Supabase, Auth, Storage, migrations, DB types, cron, providers, filas, uploads, OCR, automations, agents, errors.

UI admin sanitiza secrets. Ausência de checagem = `UNKNOWN` (honesto).
