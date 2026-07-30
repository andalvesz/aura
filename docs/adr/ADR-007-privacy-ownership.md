# ADR-007 — Privacy & Ownership

| Campo | Valor |
|-------|-------|
| Status | Accepted |
| Sprint | 6.1 — Foundation ADRs |
| Data | 2026-07-28 |
| Depende de | ADR-001 |

---

## Problema

Identity, Memory, Knowledge Graph e Discovery concentram o que há de mais íntimo sobre a vida e os negócios do usuário. Sem um ADR de **privacidade e ownership**:

- dados pessoais vazam para workspaces;
- inferências sensíveis guiam ações sem consentimento;
- exclusão/exportação ficam incompletas;
- auditoria não cobre “quem viu o quê”.

## Contexto

Já há bases sólidas no produto:

- RLS por `user_id` em várias tabelas;
- multiuser/workspace com membership e roles;
- harderning de PDF/storage e audits de isolamento;
- autonomia com confirmação para financeiro/externo/exclusão;
- princípio de não inventar métricas.

Falta um **modelo de ownership e classificação de dados** que cubra os novos engines da fundação.

## Objetivos

1. Declarar que o usuário é o dono dos dados de vida (Identity/Memory/Graph pessoais).
2. Definir escopos: personal, workspace, shared-with-consent.
3. Classificar sensibilidade e regras de uso.
4. Garantir direitos: acesso, correção, exportação, exclusão, oposição a inferências.
5. Impedir que Discovery/Execution usem dados fora do escopo.

## Alternativas consideradas

### A — “Privacy by obscurity” (só RLS técnico)

**Necessária mas insuficiente:** não cobre consentimento de inferência nem export semântico.

### B — Tudo criptografado ponta a ponta agora

**Adiada como default:** alto custo; pode vir como evolução para campos CRITICAL.

### C — Privacy & Ownership framework com escopos + classificação + direitos (escolhida)

Políticas claras ligadas a Identity/Memory/Graph/Discovery/Execution.

### D — Workspace vê tudo do membro para “colaborar melhor”

**Rejeitada:** viola ownership pessoal.

## Decisão escolhida

### Princípio de ownership

> O usuário é o **proprietário** dos dados de Identity, Memory e Knowledge Graph no escopo pessoal.  
> Workspaces possuem apenas dados explicitamente workspace-scoped.  
> O Aura Brain é **custodiante processador**, não dono.

### Escopos

| Escopo | Conteúdo típico | Quem lê |
|--------|-----------------|---------|
| `personal` | Identity core, memórias de vida, missões pessoais | Só o usuário |
| `workspace` | Dados do negócio/workspace, missões BUSINESS do workspace | Membros autorizados por role |
| `shared` | Subconjunto personal compartilhado conscientemente | Destinatários listados |
| `system` | Audit técnico mínimo necessário | Operadores sob política (sem PII extra) |

### Classificação de sensibilidade

| Classe | Exemplos | Regras |
|--------|----------|--------|
| `PUBLIC_PREF` | Idioma UI, tema | Uso amplo no produto |
| `STANDARD` | Missões genéricas, hábitos não clínicos | Uso nos engines com RLS |
| `SENSITIVE` | Financeiro detalhado, saúde, documentos | Minimização; CONFIRM para ações; sem share default |
| `RESTRICTED` | Credenciais, tokens, conteúdo médico explícito | Nunca em Discovery push; nunca em LLM logs sem redaction |

### Consentimento e inferência

1. Inferências de Identity/Discovery devem ser **visíveis e corrigíveis**.
2. Promoção Memory → Identity em dados SENSITIVE exige afirmação do usuário.
3. Compartilhar personal → workspace exige ato explícito (não membership sozinho).
4. Feedback `nao_sugerir_novamente` é direito de oposição operacional.

### Direitos do usuário (produto)

| Direito | Significado |
|---------|-------------|
| Acesso | Ver Identity/Memory/Graph relevantes |
| Correção | Editar campos inferidos/declarados |
| Exportação | Pacote estruturado da vida digital Aura (futuro) |
| Exclusão | Apagar missões/memórias/identity sections com cascata conceitual |
| Portabilidade | Formato estruturado, não só PDF |
| Oposição | Silenciar tipos de Discovery |

### Relação com Execution

- Dados RESTRICTED/SENSITIVE não autorizam AUTO_SAFE além de notificações internas não descritivas demais.
- Ações financeiras/externas/delete já exigem confirmação — reafirmado aqui.
- Nunca vender dados; nunca treinar modelos externos com payload do usuário sem política explícita futura (default: não).

## Consequências

**Positivas**

- Confiança do usuário; alinhamento com multiuser atual.
- Critérios claros para design de Identity/Memory/Graph.
- Reduz risco legal/reputacional.

**Negativas**

- Features colaborativas ficam mais lentas (consent friction).
- Export/delete completos são projetos não triviais.

## Estratégia de evolução

1. Codificar políticas neste ADR (agora).
2. Mapear dados atuais → classes de sensibilidade (inventário).
3. Garantir que novos engines nasçam com `scope` obrigatório.
4. Sprint futura: export/delete “Aura Life Pack”.
5. Opcional: E2E encryption para RESTRICTED.

## Compatibilidade futura

- Compatível com RLS e audits multiuser existentes.
- Não exige migration nesta sprint.
- Expert Brain: arquivos do usuário permanecem pessoais; influência em workspaces só via políticas explícitas.
- Mission BUSINESS em workspace vs pessoal deve declarar escopo na criação (regra futura).

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Vazamento personal→workspace via Graph joins | Escopo em todo nó/aresta |
| Inferência sensível na UI | Labels “inferido” + opt-out |
| Delete incompleto | Cascata documentada no RFC + testes futuros |
| Over-retention de Memory | TTL (ADR-003) |

## Exemplos

**OK**

Missão pessoal “Disney” só no escopo personal; workspace Alvesz não lista essa missão.

**Bloqueado**

Discovery do workspace usa gastos pessoais do owner para sugerir corte de custos da empresa → **proibido** sem share explícito.

**Direito de oposição**

Usuário desativa LearningCandidates de saúde → Discovery respeita Preference/Constraint.

**Execução**

Mesmo com Confidence HIGH, transferência financeira permanece CONFIRM (risk + privacy).

## Relação com outros componentes

| Componente | Relação |
|------------|---------|
| ADR-001 | Ownership como princípio |
| ADR-002–006 | Escopo e classificação obrigatórios |
| Aura Brain Core | Autonomia e confirmações |
| Multiuser security | RLS + roles |
| Audit | Trilha de acesso/ação |
| Mission Engine | Escopo da missão |
| RFC-001 | Privacy como restrição transversal do pipeline |
