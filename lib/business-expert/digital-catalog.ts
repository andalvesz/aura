/**
 * Digital business catalog — deep knowledge for online models.
 */

import type {
  DigitalBusinessDefinition,
  DigitalBusinessId,
} from "@/lib/business-expert/types";

export const DIGITAL_BUSINESSES: DigitalBusinessDefinition[] = [
  {
    id: "infoprodutos",
    name: "Infoprodutos",
    summary: "Conhecimento empacotado como produto digital vendável.",
    monetization: ["preço único", "upsell", "assinatura de atualização"],
    validation: ["pré-venda", "waitlist com preço", "5 entrevistas"],
    platforms: ["kiwify", "hotmart", "ticto", "kirvano", "eduzz"],
  },
  {
    id: "afiliados",
    name: "Afiliados",
    summary: "Comissão por distribuição e conversão de ofertas de terceiros.",
    monetization: ["CPA", "revshare"],
    validation: ["nicho + canal teste", "CTR e CVR de 20 peças"],
    platforms: ["hotmart", "monetizze", "braip", "kiwify", "eduzz"],
  },
  {
    id: "comunidades",
    name: "Comunidades",
    summary: "Acesso pago a rede, conteúdo e rituais.",
    monetization: ["membership", "eventos", "ofertas internas"],
    validation: ["grupo piloto pago 30 dias"],
    platforms: ["hotmart", "kiwify", "stripe"],
  },
  {
    id: "assinaturas",
    name: "Assinaturas",
    summary: "Receita recorrente por acesso contínuo.",
    monetization: ["MRR", "anual"],
    validation: ["hábito semanal do usuário"],
    platforms: ["stripe", "kiwify", "hotmart", "mercado-pago"],
  },
  {
    id: "mentorias",
    name: "Mentorias",
    summary: "Acompanhamento com método e accountability.",
    monetization: ["cohort", "1:1", "grupo"],
    validation: ["5 sessões piloto pagas"],
    platforms: ["kiwify", "hotmart", "mercado-pago"],
  },
  {
    id: "consultorias",
    name: "Consultorias",
    summary: "Diagnóstico e recomendação premium B2B/B2C.",
    monetization: ["projeto", "retainer"],
    validation: ["proposta enviada a 10 leads quentes"],
    platforms: ["mercado-pago", "stripe"],
  },
  {
    id: "cursos",
    name: "Cursos",
    summary: "Currículo estruturado com progresso e certificados opcionais.",
    monetization: ["evergreen", "lançamento", "assinatura de turma"],
    validation: ["módulo 1 + pré-venda"],
    platforms: ["kiwify", "hotmart", "herospark", "eduzz"],
  },
  {
    id: "apps",
    name: "Apps",
    summary: "Software mobile/web com retenção e ativação.",
    monetization: ["freemium", "assinatura", "IAP"],
    validation: ["problema diário + waitlist + prototype"],
    platforms: ["stripe"],
  },
  {
    id: "ferramentas-ia",
    name: "Ferramentas IA",
    summary: "Produtos que amplificam produtividade com modelos de IA.",
    monetization: ["créditos", "assinatura", "seat"],
    validation: ["workflow manual → MVP com 10 usuários"],
    platforms: ["stripe", "gumroad"],
  },
  {
    id: "templates",
    name: "Templates",
    summary: "Ativos prontos reutilizáveis (notas, planilhas, designs).",
    monetization: ["pacote", "bundle", "assinatura de pack"],
    validation: ["1 template free → paid upgrade"],
    platforms: ["gumroad", "kiwify"],
  },
  {
    id: "prompt-packs",
    name: "Prompt Packs",
    summary: "Bibliotecas de prompts com casos de uso claros.",
    monetization: ["one-shot", "pack anual"],
    validation: ["amostra free + 20 vendas smoke"],
    platforms: ["gumroad", "kiwify"],
  },
  {
    id: "newsletter",
    name: "Newsletter",
    summary: "Audiência via email com monetização posterior.",
    monetization: ["patrocínio", "produto próprio", "membership"],
    validation: ["100 inscritos engajados + open rate"],
    platforms: ["stripe", "gumroad"],
  },
  {
    id: "membership",
    name: "Membership",
    summary: "Acesso contínuo a conteúdo, comunidade e bônus.",
    monetization: ["mensal", "anual"],
    validation: ["benefício semanal claro"],
    platforms: ["hotmart", "kiwify", "stripe"],
  },
  {
    id: "marketplace",
    name: "Marketplace",
    summary: "Liquidez entre dois lados (oferta e demanda).",
    monetization: ["take rate", "featured", "assinatura sellers"],
    validation: ["um lado primeiro + matching manual"],
    platforms: ["stripe", "mercado-pago"],
  },
  {
    id: "saas",
    name: "SaaS",
    summary: "Software recorrente para workflow crítico.",
    monetization: ["assinatura", "usage", "seat"],
    validation: ["10 usuários ativos semanais", "retenção D7"],
    platforms: ["stripe", "mercado-pago"],
  },
];

const byId = new Map(DIGITAL_BUSINESSES.map((d) => [d.id, d] as const));

export function listDigitalBusinesses(): DigitalBusinessDefinition[] {
  return [...DIGITAL_BUSINESSES];
}

export function getDigitalBusiness(
  id: DigitalBusinessId
): DigitalBusinessDefinition | undefined {
  return byId.get(id);
}
