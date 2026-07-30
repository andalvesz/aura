# Aura Brain — Matrizes oficiais (RC1 / Architecture v1.0)

Referenciadas por [aura-brain-architecture-v1.md](./aura-brain-architecture-v1.md).

---

## A. Matriz de autoridade

| Fonte | Autoridade operacional | Autoridade factual | Pode inferir | Pode sobrescrever fontes | Requer confirmação |
|-------|------------------------|--------------------|--------------|--------------------------|--------------------|
| Declaração explícita do usuário | alta | alta | não | preferências/claims | implícita |
| Correção explícita do usuário | alta | alta | não | interpretação/projeção | sim |
| Identity Claim CONFIRMED | — | alta | limitada | não domínio | já confirmada |
| Identity hipótese/observação | — | baixa | sim (gated) | não | para promoção |
| Memory | — | histórica | limitada | não | SENSITIVE sim |
| World Model | — | projeção | baixa | não | relações críticas |
| Cognitive Artifact | — | interpretação | sim + validator | não | para CONFIRMED |
| Discovery Artifact | — | sinal (futuro) | sim | não | CTA |
| Provider/LLM | nenhuma | nenhuma | redação | não | n/a |
| Documento externo | domínio | evidência tipada | não como fato | não | conforme sensibilidade |
| Evento de sistema | operacional | evidência | não | não | — |
| Mission / domínio | **alta** | operacional | — | n/a | por risk/autonomia |

---

## B. Matriz de dependências

| Origem | Destino | Permitido | Tipo | Observação |
|--------|---------|-----------|------|------------|
| Identity | Memory/Cognitive/Discovery | não | — | Identity não depende de Cognitive |
| Memory | Identity | sim | promoção via service | contratos públicos |
| Memory | Cognitive/Discovery | não | — | |
| World Model | Identity/Memory/Mission | sim | read + project | type-only no puro |
| Cognitive | Identity/Memory/World/Mission | sim | read-only | |
| Cognitive | Execution | **não** | — | |
| Discovery | * | n/a | — | não implementado |
| Brain Core | *ForBrain | sim | read-only | |
| UI | services/actions | sim | — | stores proibidos |
| UI | stores internos | **não** | — | corrigido RC1 |

---

## C. Matriz de contratos públicos (classificação)

| Contrato | Engine | Classe |
|----------|--------|--------|
| `getIdentityProfile` / Claims CRUD / `getIdentityHintsForBrain` | Identity | STABLE |
| `recordExperience` / Memory CRUD / `getMemoryContextForBrain` | Memory | STABLE |
| `promoteMemory` / `evaluateMemoryPromotion` | Memory | STABLE |
| World entity/rel CRUD / neighbors / findPath / projectors / `getWorldContextForBrain` | World | STABLE |
| `listWorldRelationships` | World | STABLE (RC1) |
| Cognitive generate/list/feedback/brain/bootstrap | Cognitive | STABLE |
| Pure `*Pure` engines | * | INTERNAL |
| Stores `get*State` | * | INTERNAL |
| Discovery * | Discovery | — (ausente) |
| Legacy `ai_memories` / aura-brain/memory providers | legado | LEGACY |

---

## D. Matriz de confidence

| Camada | Score | Fonte | Método | Autoridade | Confirma fato? |
|--------|-------|-------|--------|------------|----------------|
| Identity | claim confidence | create/observe/confirm | identity-confidence | user confirm alta | sim se CONFIRMED |
| Memory | memory confidence | create/feedback | memory-confidence | evidência tipada | não sozinha |
| Promotion | promotionConfidence | gates | promotion | decisão de promoção | não |
| World entity/rel | entity/rel confidence | projection | world-confidence | projeção | não |
| World | projectionConfidence | min(source, entity) | world | — | não |
| Cognitive evidence/pattern/hyp/insight/rec | separados | calculator v1 | cognitive-confidence-v1 | interpretação | nunca 100 inferência |
| Discovery | — | — | — | futuro | — |
| Mission score.confidence | mission | planner/score | operacional | ≠ epistemic | — |

---

## E. Matriz de status / lifecycle (famílias)

| Família | Exemplos de status | Engines |
|---------|--------------------|---------|
| Observation | OBSERVED, HYPOTHESIS, LIKELY | Identity |
| Review | PENDING_REVIEW, GENERATED, VALIDATED, DISPUTED | Cognitive, World |
| Knowledge | CONFIRMED, CORRECTED, LEARNED, ACTIVE | Identity, Memory, World |
| Artifact | GENERATED → CONFIRMED/REJECTED/SUPERSEDED/OUTDATED | Cognitive |
| Operational | ACTIVE, paused, completed (missões) | Mission |
| Deletion | ARCHIVED, DELETED | todas |

Regras: REJECTED não volta ACTIVE silenciosamente; DELETED fora de leitura normal; OUTDATED ≠ atual; SUPERSEDED preserva histórico; CONFIRMED exige ato humano quando aplicável.

---

## F. Matriz de tipos de artefato

| Tipo | Camada | Significado |
|------|--------|-------------|
| IdentityClaim | Identity | atributo/preferência |
| MemoryRecord | Memory | episódica/semântica/… |
| WorldEntity / WorldRelationship | World | projeção |
| PATTERN/CONFLICT/INSIGHT/… | Cognitive | interpretação |
| DiscoveryCandidate | Discovery | futuro |
| Mission | Mission | operacional |

---

## G. Matriz de permissões

| Ação | Requisito |
|------|-----------|
| Ler artefatos | auth + ownership (+ workspace) |
| Mutar | auth + ownership |
| Brain slice | auth + filtros |
| Cross-user | **proibido** |
| Inferência RESTRICTED | bloqueada / explícita |

---

## H. Matriz de execução

| Capacidade | Identity | Memory | World | Cognitive | Discovery | Mission/Planner |
|------------|----------|--------|-------|-----------|-----------|-----------------|
| Influenciar Execution | none | none | none | none | n/a | gated |
| Criar missão | não | não | não | não | futuro CTA | sim (usuário/engine) |
| Agenda/finanças | não | não | não | não | não | CONFIRM |

---

## I. Dados sensíveis

PUBLIC_PREF · STANDARD · SENSITIVE · RESTRICTED — ADR-007.  
Bloqueio clínico/psicológico em Identity/Memory/World/Cognitive.

---

## J. Suppression

| Camada | Escopo | Quebra |
|--------|--------|--------|
| Identity | rejeição de claim | nova evidência + fluxo explícito |
| Memory | feedback / forget | política de retenção |
| World | reject relação | nova evidência independente |
| Cognitive | suppress_similar | expiração / usuário / nova evidência |
| Cross-layer | **não automático** | política explícita futura |

---

## K. Auditoria

Tabelas: `aura_identity_audit`, `aura_memory_audit`, `aura_world_audit`, `aura_cognitive_audit` (+ brain audit).  
Append-only (SELECT+INSERT).

---

## L. Providers

| Provider | Status |
|----------|--------|
| `none` (Cognitive) | suportado |
| LLM real | não ligado; interface preparada |
| Regras | sem DB, sem tools, sem CoT, validator obrigatório |
