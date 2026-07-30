# ADR-002 — Identity Engine

| Campo | Valor |
|-------|-------|
| Status | Accepted |
| Sprint | 6.1 — Foundation ADRs |
| Data | 2026-07-28 |
| Depende de | ADR-001, ADR-007 |

---

## Problema

Hoje o Aura Brain conhece o usuário principalmente como `userId` + perfil (`full_name`, email) + contexto personal/workspace. Isso é insuficiente para:

- personalizar missões, tom e prioridades de forma estável;
- distinguir “quem eu sou” de “o que aconteceu hoje”;
- evitar que Memory e Discovery misturem fatos transitórios com identidade duradoura;
- servir múltiplos papéis (pessoa física, founder, membro de workspace) sem colidir.

## Contexto

- Auth: Supabase Auth (`auth.users`) + `profiles`.
- Contexto: personal vs workspace (`getDataContext`, memberships, roles).
- Aura Brain settings: autonomia, quiet hours, limites diários.
- Expert Brain: conhecimento externo ingerido — **não** é identidade do usuário.
- Missões já tipam PERSONAL/BUSINESS/… mas sem perfil de identidade rico.

Identity Engine deve ser a fonte da verdade sobre **atributos estáveis e preferências declaradas/inferidas**, não sobre eventos do dia.

## Objetivos

1. Modelar identidade multi-camada: pessoal, profissional, preferências, restrições.
2. Separar Identity (durável) de Memory (episódica/semântica) e de Knowledge Graph (relações).
3. Permitir papéis e contextos sem duplicar usuários.
4. Alimentar Mission templates, Discovery e Communication com perfil coerente.
5. Respeitar Privacy: identidade sensível com consentimento e exportabilidade.

## Alternativas consideradas

### A — Só `profiles` + settings

Ampliar colunas no perfil.  
**Rejeitada a longo prazo:** vira “god table”; não modela papéis, restrições nem versão.

### B — Identity = embeddings do histórico de chat

Inferir “quem é” só de conversas.  
**Rejeitada:** opaco, não auditável, conflita com ADR-001 (estrutura > chat).

### C — Identity Engine tipado com versões e escopos (escolhida)

Documento de identidade versionado, por escopo (`personal` | `workspace_member`), com seções explícitas e sinais de confiança por campo.

### D — Um Identity por missão

**Rejeitada:** explosão de identidades; missão consome Identity, não a substitui.

## Decisão escolhida

Criar o **Identity Engine** como motor conceitual de primeira classe.

### Conceito

**Identity** = representação estruturada, versionada e ownership-bound de:

- quem o usuário é (auto-descrição e papéis);
- o que valoriza e prioriza;
- restrições duráveis (saúde, orçamento, tempo, ética);
- preferências de comunicação e autonomia;
- contextos em que atua (pessoal / negócios / workspaces).

### Camadas conceituais (não schema)

1. **Core Identity** — nome preferido, idioma, fuso, papéis declarados.
2. **Life Profile** — saúde geral, família/contexto relevante (mínimo necessário), estilo de vida.
3. **Work Profile** — founder/empregado, setores de interesse, estágio de negócio (se houver).
4. **Preference Profile** — autonomia default, quiet hours, tom (direto/suave), densidade de sugestões.
5. **Constraint Profile** — “não sugerir X”, limites financeiros, restrições de calendário.
6. **Mission Affinity** — tipos de missão preferidos / históricos (derivado, não fonte primária).

### Regras

- Identity **não** armazena eventos do dia (isso é Memory).
- Identity **não** é grafo de entidades do mundo (isso é Knowledge Graph).
- Campos inferidos vs declarados devem ser distinguíveis.
- Inferências exigem Confidence mínima antes de influenciar Execution.
- Workspace: identidade de membro ≠ identidade pessoal completa; compartilhamento é opt-in (ADR-007).

### Facade futura (contrato de produto)

Aplicação consumirá algo na linha de `getIdentity(scope)` — **não especificar implementação nesta sprint.**

## Consequências

**Positivas**

- Personalização estável para Missões e Discovery.
- Menos “amnésia” entre sessões sem misturar com logs brutos.
- Base para Confidence (confiança no perfil).

**Negativas**

- Onboarding precisa coletar ou inferir com cuidado.
- Risco de perfil desatualizado → precisa de revisão periódica (estratégia abaixo).

## Estratégia de evolução

1. **Design (agora):** ADR + campos conceituais.
2. **Bootstrap:** mapear o que já existe (profile, settings, autonomy) → Identity Core.
3. **Enrichment:** preferências e constraints a partir de feedback (learning) e declarações.
4. **Mission coupling:** templates ajustam-se a Identity Affinity.
5. **Review loop:** usuário pode corrigir campos inferidos (human-in-the-loop).

## Compatibilidade futura

- Não quebra `profiles` nem auth atual.
- Aura Brain settings migram conceitualmente para Preference Profile (sem migration nesta sprint).
- Expert Brain continua separado: “o que aprendi de fontes” ≠ “quem eu sou”.
- Mission Engine V1 continua; Identity apenas enriquece criação/priorização depois.

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Perfil errado guia missões ruins | Campos inferidos com Confidence baixa = só sugestão |
| Vazamento identity pessoal → workspace | Escopos + ADR-007 |
| Over-collection de dados sensíveis | Minimização; Consent Profile |
| Duplicação com Memory | Fronteira explícita neste ADR |

## Exemplos

**Exemplo 1 — Core + Preference**

Usuário declara: prefere autonomia SUGGEST, quiet hours 22h–7h, idioma pt-BR, papel “founder part-time”.  
Mission Engine prioriza missões BUSINESS com menor agressividade de automação noturna.

**Exemplo 2 — Constraint**

Constraint: “não criar lançamentos financeiros sem confirmação” (já alinhado ao Brain Core).  
Identity torna isso preferência durável, não só setting efêmero.

**Exemplo 3 — Inferência cautelosa**

Padrão de treinos 4x/semana por 2 meses → Identity Life Profile sugere “alta consistência em saúde” com Confidence média → Discovery pode sugerir missão HEALTH, sem alterar Execution sozinha.

## Relação com outros componentes

| Componente | Relação |
|------------|---------|
| ADR-001 | Identity serve a filosofia de SO cognitivo |
| ADR-003 Memory | Memory alimenta *candidatos* a Identity; Identity só promove o que for estável |
| ADR-004 Graph | Nós “Person/Self” no grafo referenciam Identity, não a duplicam |
| ADR-005 Confidence | Score por campo/afirmação de identidade |
| ADR-006 Discovery | Segmenta descobertas pelo perfil |
| ADR-007 Privacy | Escopo, export, delete, consent |
| Mission Engine | Escolha de template e prioridade |
| Planner | Tom e autonomia default |
| Communication presenter | Personalização de mensagens |
| RFC-001 | Primeira etapa do pipeline |
