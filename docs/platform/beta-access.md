# Beta Access

Estados: `INVITED` | `ACTIVE` | `SUSPENDED` | `REVOKED`

Usuários atuais permanecem **ACTIVE** (`ensureBetaActive` / RPC `ensure_beta_active_for_user`).

Admin agrega status em `/dashboard/admin/platform` — sem impersonação, sem conteúdo privado.

Feature flags `beta.*` liberam módulos gradualmente e **não** substituem autorização.
