# RFC-002 — Identity Engine Implementation (Sprint 6.2)

| Campo | Valor |
|-------|-------|
| Status | Implemented (V1) |
| Data | 2026-07-28 |
| Base | ADR-001, ADR-002, ADR-005, ADR-007, RFC-001 |
| Código | `lib/identity/*`, `lib/supabase/services/identity-engine.service.ts` |

---

## 1. Resumo

Implementa a primeira versão funcional do Identity Engine como claims tipadas com confidence lifecycle, evidências, conflitos, perfil consolidado, UI de revisão, RLS e integração read-only ao Aura Brain Core.

## 2. Decisões de implementação (sem alterar ADRs)

1. **Claims atômicas** em vez de um JSON único de identidade (ADR-002).  
2. **Categorias como `text`** no banco — extensíveis sem migration por categoria.  
3. **Confidence 0–100 + bandas** LOW/MEDIUM/HIGH (ADR-005).  
4. **Privacy gate** bloqueia inferência automática de chaves clínicas/sensíveis (ADR-007).  
5. **Brain recebe só hints confirmados**; `executionInfluence: "none"`.  
6. **Persistência dual:** store em processo + upsert best-effort (padrão Mission/Aura settings).  
7. **Bootstrap** apenas de dados já confirmados (perfil, settings, tipos de missão criados).  
8. **Sem hardcode** de usuários, marcas ou hobbies no código.

## 3. Pipeline (atualizado)

```
Identity (V1 claims) ──read-only──► Aura Brain Core
       │
       ▼
Memory / Graph / Discovery   (ainda não implementados — Sprint futura)
```

Identity **não** cria missões, **não** altera calendário, **não** dispara AUTO_SAFE.

## 4. Fluxo de confiança

```
create/observe
  → sourceTrustBaseline(source)
  → clamp + anti-HIGH para fontes isoladas
  → statusFromConfidence
  → confidenceHistory append (nunca silencioso)

user confirm → 95 + CONFIRMED
user reject  → 0 + REJECTED
user correct → valor novo + CONFIRMED
multi-evidence (fontes não isoladas) → pode subir até LIKELY
```

## 5. Fluxo confirmação / rejeição

```
UI / action
  → confirmIdentityClaim | rejectIdentityClaim
  → pure engine + audit event
  → invalidate profile cache
  → persist claim + audit
```

REJECTED some do `getIdentityProfile` (confirmed/likely/hypotheses).

## 6. Conflitos

Mesmo `category+key+contextScope` com valores distintos → `IdentityConflict` no perfil; UI destaca; sistema **não** escolhe vencedor.

## 7. Testes / DoD

Ver `reports/sprint-6.2-identity-engine.md`.

## 8. Próximo (fora deste RFC)

Sprint 6.3 sugerida: Memory Engine V1 (tipos episódica/semântica + promoção gated para Identity).
