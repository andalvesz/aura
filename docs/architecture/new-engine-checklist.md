# Checklist — Novas engines (Aura Brain)

Toda futura engine deve responder **antes** de implementar.

## Problema e fronteira

- [ ] Qual problema resolve?
- [ ] É engine, detector, projector ou consumer?
- [ ] Quais fontes lê? Quais escreve?
- [ ] Qual autoridade dos dados produzidos?
- [ ] Qual tipo de artefato produz?

## Evidência e confiança

- [ ] Como preserva evidências?
- [ ] Como calcula confidence? (método + versão)
- [ ] Confidence é separado de outras camadas?
- [ ] Como lida com contradição / correção / rejection / suppression?
- [ ] Como lida com temporalidade / outdated / supersession?

## Segurança e ownership

- [ ] Idempotência e dedupe?
- [ ] Isolamento user/workspace + RLS?
- [ ] Dados sensíveis (ADR-007)?
- [ ] Enumeração de IDs prevenida?

## Providers

- [ ] Usa provider? Qual interface?
- [ ] Fallback determinístico?
- [ ] Sem chain-of-thought persistida?
- [ ] Prompt injection tratada?

## Execução

- [ ] Influencia execução? Qual `executionInfluence`?
- [ ] Kernel cognitivo deve permanecer `"none"` até Decision Support aprovado.

## Contratos e ops

- [ ] Contratos públicos (STABLE vs EXPERIMENTAL)?
- [ ] Índices / paginação / limites?
- [ ] Testes (unit + isolamento + brain read-only)?
- [ ] ADR necessário? RFC necessário?
- [ ] Como desativar / versionar / migrar / observar / auditar?

## Documentação

- [ ] Atualizar `docs/adr/README.md` pipeline
- [ ] Architecture doc + matrices
- [ ] Relatório de sprint
- [ ] Sem hardcode de usuário/domínio no código
