/**
 * Business Expert domain registries — domains, archetypes, platform status.
 */

import type {
  BusinessKnowledgeDomainId,
  BusinessTypeCard,
  DomainDefinition,
  SupportedBusinessType,
} from "@/lib/business-expert/types";
import {
  BUSINESS_EXPERT_CAPABILITY_ID,
  BUSINESS_EXPERT_SKILL_ID,
} from "@/lib/business-expert/types";
import { listMarketplaces } from "@/lib/business-expert/marketplaces";
import { listBusinessModes } from "@/lib/business-expert/modes";
import { listDigitalBusinesses } from "@/lib/business-expert/digital-catalog";
import { listLocalBusinesses } from "@/lib/business-expert/local-catalog";
import { listKnowledgePacks } from "@/lib/business-expert/knowledge-packs";
import { listMarketingChannels } from "@/lib/business-expert/marketing-registry";
import {
  ensurePlatformRegistries,
  getCapability,
  getSkill,
  isCapabilityRegistered,
  isSkillRegistered,
} from "@/lib/capabilities/registry";

export const BUSINESS_KNOWLEDGE_DOMAINS: DomainDefinition[] = [
  { id: "mercado", name: "Mercado", summary: "Clientes, demanda e contexto de mercado.", keyQuestions: ["Quem é o cliente?", "Qual dor paga?", "Qual o tamanho realista?"] },
  { id: "empreendedorismo", name: "Empreendedorismo", summary: "Caminhos para criar e operar negócios.", keyQuestions: ["Vale empreender agora?", "Qual o menor passo?"] },
  { id: "marketing", name: "Marketing", summary: "Mensagem, canais e demanda.", keyQuestions: ["Onde o cliente está?", "Qual mensagem?"] },
  { id: "vendas", name: "Vendas", summary: "Conversão e ciclo comercial.", keyQuestions: ["Qual o próximo passo?", "Como qualificar?"] },
  { id: "growth", name: "Growth", summary: "Experimentação, aquisição e retenção.", keyQuestions: ["Qual a métrica norte?", "O que escalar?"] },
  { id: "financeiro", name: "Financeiro", summary: "Caixa, margem e viabilidade.", keyQuestions: ["Unit economics?", "Runway?"] },
  { id: "produto", name: "Produto", summary: "Oferta, MVP e valor.", keyQuestions: ["Qual o núcleo?", "Como provar rápido?"] },
  { id: "operacao", name: "Operação", summary: "Entrega consistente.", keyQuestions: ["O que quebra se escalar?"] },
  { id: "escala", name: "Escala", summary: "Alavancas de crescimento.", keyQuestions: ["O que é alavanca?"] },
  { id: "juridico", name: "Jurídico básico", summary: "Orientação geral — não substitui advogado.", keyQuestions: ["Há contrato?", "Marca/IP?"], guidanceOnly: true },
  { id: "impostos", name: "Impostos", summary: "Orientação geral — não substitui contador.", keyQuestions: ["Fluxo separado?", "Comprovantes?"], guidanceOnly: true },
  { id: "validacao", name: "Validação", summary: "Testes baratos de hipótese.", keyQuestions: ["Qual hipótese?", "Qual evidência?"] },
  { id: "concorrencia", name: "Concorrência", summary: "Alternativas reais do cliente.", keyQuestions: ["Quem já resolve?", "Como se diferenciar?"] },
  { id: "posicionamento", name: "Posicionamento", summary: "Para quem e contra o quê.", keyQuestions: ["Público?", "Promessa?"] },
  { id: "oferta", name: "Oferta", summary: "Pacote de valor vendável.", keyQuestions: ["O que inclui?", "Qual transformação?"] },
  { id: "preco", name: "Preço", summary: "Precificação e âncoras.", keyQuestions: ["Ancoragem?", "Floor?"] },
  { id: "branding", name: "Branding", summary: "Consistência de marca e confiança.", keyQuestions: ["O que deve ser lembrado?"] },
  { id: "aquisicao", name: "Aquisição", summary: "Como chegar a clientes novos.", keyQuestions: ["Canal primário?", "CPA?"] },
  { id: "retencao", name: "Retenção", summary: "Manter e expandir clientes.", keyQuestions: ["Por que cancelam?"] },
  { id: "modelos-de-negocio", name: "Modelos de negócio", summary: "Como vira receita.", keyQuestions: ["Quem paga?", "Unidade de valor?"] },
  { id: "monetizacao", name: "Monetização", summary: "Cobrança e empacotamento.", keyQuestions: ["Primeira receita?", "Recorrência?"] },
];

export const SUPPORTED_BUSINESS_TYPES: BusinessTypeCard[] = [
  { id: "produto-digital", name: "Produto Digital", summary: "Assets digitais vendáveis.", typicalMonetization: ["one-shot", "upsell"], commonRisks: ["sem distribuição"], validationHints: ["pré-venda"], bestFitCapital: ["bootstrap", "low"], digital: true },
  { id: "infoproduto", name: "Infoproduto", summary: "Conhecimento empacotado.", typicalMonetization: ["curso", "upsell"], commonRisks: ["baixa prova"], validationHints: ["módulo 1 + pré-venda"], bestFitCapital: ["bootstrap", "low"], digital: true },
  { id: "curso", name: "Curso", summary: "Currículo estruturado.", typicalMonetization: ["evergreen", "lançamento"], commonRisks: ["conclusão baixa"], validationHints: ["turma piloto"], bestFitCapital: ["low", "medium"], digital: true },
  { id: "afiliado", name: "Afiliado", summary: "Comissão por distribuição.", typicalMonetization: ["CPA"], commonRisks: ["dependência"], validationHints: ["teste de canal"], bestFitCapital: ["bootstrap"], digital: true },
  { id: "saas", name: "SaaS", summary: "Software recorrente.", typicalMonetization: ["assinatura"], commonRisks: ["churn", "build excessivo"], validationHints: ["10 usuários ativos"], bestFitCapital: ["medium", "high", "funded"], digital: true },
  { id: "app", name: "App", summary: "Aplicativo mobile/web.", typicalMonetization: ["freemium", "IAP"], commonRisks: ["retenção"], validationHints: ["prototype"], bestFitCapital: ["medium", "high"], digital: true },
  { id: "ferramenta-ia", name: "Ferramenta IA", summary: "Produtividade com IA.", typicalMonetization: ["créditos", "seat"], commonRisks: ["custo de API"], validationHints: ["workflow manual"], bestFitCapital: ["low", "medium"], digital: true },
  { id: "template", name: "Templates", summary: "Ativos reutilizáveis.", typicalMonetization: ["pack"], commonRisks: ["pirataria"], validationHints: ["free sample"], bestFitCapital: ["bootstrap"], digital: true },
  { id: "prompt-pack", name: "Prompt Packs", summary: "Bibliotecas de prompts.", typicalMonetization: ["one-shot"], commonRisks: ["commoditização"], validationHints: ["amostra"], bestFitCapital: ["bootstrap"], digital: true },
  { id: "newsletter", name: "Newsletter", summary: "Audiência por email.", typicalMonetization: ["patrocínio", "produto"], commonRisks: ["consistência"], validationHints: ["100 inscritos"], bestFitCapital: ["bootstrap"], digital: true },
  { id: "membership", name: "Membership", summary: "Acesso contínuo pago.", typicalMonetization: ["mensal"], commonRisks: ["churn"], validationHints: ["benefício semanal"], bestFitCapital: ["low"], digital: true },
  { id: "marketplace", name: "Marketplace", summary: "Dois lados + liquidez.", typicalMonetization: ["take rate"], commonRisks: ["chicken-egg"], validationHints: ["um lado primeiro"], bestFitCapital: ["medium", "funded"], digital: true },
  { id: "agencia", name: "Agência", summary: "Serviços em escala de projeto/retainer.", typicalMonetization: ["projeto", "retainer"], commonRisks: ["escopo"], validationHints: ["1 vertical"], bestFitCapital: ["bootstrap", "low"] },
  { id: "consultoria", name: "Consultoria", summary: "Expertise premium.", typicalMonetization: ["hora", "pacote"], commonRisks: ["teto de tempo"], validationHints: ["problema caro"], bestFitCapital: ["bootstrap"] },
  { id: "mentoria", name: "Mentoria", summary: "Acompanhamento com método.", typicalMonetization: ["cohort"], commonRisks: ["promessa excessiva"], validationHints: ["piloto pago"], bestFitCapital: ["bootstrap"] },
  { id: "comunidade", name: "Comunidade", summary: "Rede e pertencimento pagos.", typicalMonetization: ["assinatura"], commonRisks: ["retenção"], validationHints: ["grupo-piloto"], bestFitCapital: ["bootstrap", "low"], digital: true },
  { id: "assinatura", name: "Assinatura", summary: "Receita recorrente.", typicalMonetization: ["MRR"], commonRisks: ["churn"], validationHints: ["hábito"], bestFitCapital: ["low", "medium"], digital: true },
  { id: "prestacao-de-servico", name: "Prestação de Serviço", summary: "Entrega sob demanda.", typicalMonetization: ["unitário", "pacote"], commonRisks: ["agenda"], validationHints: ["preço mínimo"], bestFitCapital: ["bootstrap"] },
  { id: "loja-fisica", name: "Loja Física", summary: "Ponto de venda local.", typicalMonetization: ["margem"], commonRisks: ["aluguel"], validationHints: ["popup"], bestFitCapital: ["medium", "high"], local: true },
  { id: "e-commerce", name: "E-commerce", summary: "Loja online + logística.", typicalMonetization: ["margem", "kits"], commonRisks: ["CAC", "estoque"], validationHints: ["smoke ads"], bestFitCapital: ["low", "medium"], digital: true },
  { id: "negocios-locais", name: "Negócios Locais", summary: "Operação de bairro/cidade.", typicalMonetization: ["serviço local"], commonRisks: ["sazonalidade"], validationHints: ["5 clientes no raio"], bestFitCapital: ["bootstrap", "low", "medium"], local: true },
  { id: "creator", name: "Creator", summary: "Audiência como ativo.", typicalMonetization: ["produto", "patrocínio"], commonRisks: ["algoritmo"], validationHints: ["cadência 30 dias"], bestFitCapital: ["bootstrap"], digital: true },
];

const domainById = new Map(BUSINESS_KNOWLEDGE_DOMAINS.map((d) => [d.id, d] as const));
const typeById = new Map(SUPPORTED_BUSINESS_TYPES.map((t) => [t.id, t] as const));

export function listKnowledgeDomains(): DomainDefinition[] {
  return [...BUSINESS_KNOWLEDGE_DOMAINS];
}

export function getKnowledgeDomain(
  id: BusinessKnowledgeDomainId
): DomainDefinition | undefined {
  return domainById.get(id);
}

export function listSupportedBusinessTypes(): BusinessTypeCard[] {
  return [...SUPPORTED_BUSINESS_TYPES];
}

export function getSupportedBusinessType(
  id: SupportedBusinessType
): BusinessTypeCard | undefined {
  return typeById.get(id);
}

export function listDomainIds(): BusinessKnowledgeDomainId[] {
  return BUSINESS_KNOWLEDGE_DOMAINS.map((d) => d.id);
}

export function listBusinessTypeIds(): SupportedBusinessType[] {
  return SUPPORTED_BUSINESS_TYPES.map((t) => t.id);
}

export function ensureBusinessExpertRegistered(): {
  capability: boolean;
  skill: boolean;
  domains: number;
  businessTypes: number;
  marketplaces: number;
  modes: number;
  digital: number;
  local: number;
  packs: number;
  channels: number;
} {
  ensurePlatformRegistries();
  return {
    capability: isCapabilityRegistered(BUSINESS_EXPERT_CAPABILITY_ID),
    skill: isSkillRegistered(BUSINESS_EXPERT_SKILL_ID),
    domains: BUSINESS_KNOWLEDGE_DOMAINS.length,
    businessTypes: SUPPORTED_BUSINESS_TYPES.length,
    marketplaces: listMarketplaces().length,
    modes: listBusinessModes().length,
    digital: listDigitalBusinesses().length,
    local: listLocalBusinesses().length,
    packs: listKnowledgePacks().length,
    channels: listMarketingChannels().length,
  };
}

export function getBusinessExpertRegistration() {
  ensurePlatformRegistries();
  return {
    capability: getCapability(BUSINESS_EXPERT_CAPABILITY_ID) ?? null,
    skill: getSkill(BUSINESS_EXPERT_SKILL_ID) ?? null,
  };
}
