/**
 * Business modes — operating lenses over the same expert skill.
 */

import type {
  BusinessModeDefinition,
  BusinessModeId,
} from "@/lib/business-expert/types";

export const BUSINESS_MODES: BusinessModeDefinition[] = [
  {
    id: "afiliado",
    name: "Afiliado",
    summary: "Distribui ofertas de terceiros e converte audiência em comissão.",
    fitWhen: ["pouco capital", "gosta de conteúdo", "não quer produzir produto agora"],
    primaryDomains: ["marketing", "vendas", "aquisicao", "oferta"],
    typicalTypes: ["afiliado", "creator"],
    firstMoves: ["escolher 1 nicho", "escolher 1 plataforma", "publicar 10 peças"],
  },
  {
    id: "produtor",
    name: "Produtor",
    summary: "Cria e vende o próprio produto digital ou físico.",
    fitWhen: ["expertise clara", "pode validar com pré-venda"],
    primaryDomains: ["produto", "oferta", "preco", "validacao"],
    typicalTypes: ["infoproduto", "curso", "produto-digital", "template"],
    firstMoves: ["definição de promessa", "pré-venda", "MVP de conteúdo"],
  },
  {
    id: "prestador",
    name: "Prestador",
    summary: "Troca skill por dinheiro via serviço unitário ou pacotes.",
    fitWhen: ["precisa de caixa rápido", "skill comercializável"],
    primaryDomains: ["vendas", "oferta", "operacao", "preco"],
    typicalTypes: ["prestacao-de-servico", "consultoria"],
    firstMoves: ["oferta com resultado", "10 contatos", "1 case"],
  },
  {
    id: "agencia",
    name: "Agência",
    summary: "Entrega serviços especializados com processos e time.",
    fitWhen: ["repetibilidade", "pode contratar/parceiros"],
    primaryDomains: ["operacao", "vendas", "retencao", "escala"],
    typicalTypes: ["agencia"],
    firstMoves: ["1 oferta vertical", "pacote com prazo", "pipeline semanal"],
  },
  {
    id: "startup",
    name: "Startup",
    summary: "Busca escala com produto repetível (ex.: SaaS).",
    fitWhen: ["problema recorrente", "pode construir/iterar"],
    primaryDomains: ["produto", "validacao", "growth", "financeiro"],
    typicalTypes: ["saas", "app", "ferramenta-ia", "marketplace"],
    firstMoves: ["problema pago", "MVP", "métrica norte"],
  },
  {
    id: "empresa-local",
    name: "Empresa Local",
    summary: "Operação de bairro/cidade com presença física ou serviço local.",
    fitWhen: ["vínculo local", "capital para operação"],
    primaryDomains: ["operacao", "marketing", "financeiro", "aquisicao"],
    typicalTypes: ["negocios-locais", "loja-fisica"],
    firstMoves: ["mapa de demanda local", "custos fixos", "oferta de abertura"],
  },
  {
    id: "creator",
    name: "Creator",
    summary: "Audiência como ativo: conteúdo → confiança → oferta.",
    fitWhen: ["consistência de conteúdo", "gosta de criar"],
    primaryDomains: ["branding", "aquisicao", "oferta", "retencao"],
    typicalTypes: ["creator", "newsletter", "comunidade", "membership"],
    firstMoves: ["nicho editorial", "cadência", "oferta simples"],
  },
  {
    id: "freelancer",
    name: "Freelancer",
    summary: "Serviço individual premium com portfólio.",
    fitWhen: ["skill rara", "quer autonomia"],
    primaryDomains: ["posicionamento", "preco", "vendas", "branding"],
    typicalTypes: ["prestacao-de-servico", "consultoria"],
    firstMoves: ["nicho", "preço mínimo", "3 provas"],
  },
];

const byId = new Map(BUSINESS_MODES.map((m) => [m.id, m] as const));

export function listBusinessModes(): BusinessModeDefinition[] {
  return [...BUSINESS_MODES];
}

export function getBusinessMode(id: BusinessModeId): BusinessModeDefinition | undefined {
  return byId.get(id);
}

export function recommendModes(input: {
  capital?: string;
  prefersDigital?: boolean;
  wantsLocal?: boolean;
  wantsAudience?: boolean;
}): BusinessModeDefinition[] {
  const out: BusinessModeDefinition[] = [];
  if (input.wantsLocal) out.push(byId.get("empresa-local")!);
  if (input.wantsAudience) out.push(byId.get("creator")!);
  if (input.capital === "bootstrap" || input.capital === "low") {
    out.push(byId.get("afiliado")!, byId.get("freelancer")!, byId.get("prestador")!);
  }
  if (input.prefersDigital) {
    out.push(byId.get("produtor")!, byId.get("startup")!);
  }
  const unique = new Map(out.filter(Boolean).map((m) => [m.id, m]));
  return [...unique.values()].slice(0, 4);
}
