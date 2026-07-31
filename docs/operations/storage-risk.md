# Storage risk notes (Sprint 10.1)

## Achados

- Buckets Alvesz PDF já endurecidos em migrations anteriores (privado + membership)
- Platform foundation não cria novos buckets públicos
- Objetos órfãos: **não** apagar automaticamente

## Riscos residuais

| Risco | Severidade | Mitigação |
|-------|------------|-----------|
| Signed URL vazada | média | TTL curto; não logar URL completa |
| Path sem workspace | média | Auditar uploads legados |
| Público legado | alta se existir | Relistar buckets; tornar privado |

## Policies necessárias

Aplicar apenas após inventário manual — sem wipe.
