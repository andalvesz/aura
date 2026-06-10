import type { CreatorLanding, LandingModelo } from "@/types/database";
import type { CreatorProductBundle } from "@/utils/creator";
import { formatBRL } from "@/utils/creator";
import type { CreatorLocalePartial } from "@/utils/creator-locale";
import { localeFieldsFromSource } from "@/utils/creator-locale";
import { parseJsonStringArray } from "@/utils/research";

export type LandingIntake = {
  nome: string;
  avatar: string;
  problema: string;
  solucao: string;
  promessa: string;
  diferencial: string;
  preco: number | null;
  product_id?: string | null;
  copylab_id?: string | null;
  landing_id?: string | null;
  modelo: LandingModelo;
} & CreatorLocalePartial;

export type LandingGenerateKind = "generate" | "improve" | "optimize";

export type LandingDepoimento = {
  nome: string;
  texto: string;
  resultado?: string;
};

export type LandingFaqItem = {
  pergunta: string;
  resposta: string;
};

export type GeneratedLanding = {
  hero_section: string;
  headline: string;
  subheadline: string;
  beneficios: string[];
  section_problema: string;
  section_solucao: string;
  depoimentos: LandingDepoimento[];
  garantia: string;
  bonus: string;
  faq: LandingFaqItem[];
  cta: string;
  rodape: string;
};

export type LandingDashboardMetrics = {
  totalLandings: number;
  ultimoProduto: string;
  comFaq: number;
  modelosUsados: number;
  vinculados: number;
};

export const LANDING_MODELS: { id: LandingModelo; label: string; description: string }[] = [
  {
    id: "pagina_simples",
    label: "Página simples",
    description: "Hero, benefícios, CTA e rodapé — conversão direta.",
  },
  {
    id: "pagina_longa",
    label: "Página longa",
    description: "Estrutura completa com problema, solução, FAQ e depoimentos.",
  },
  {
    id: "captura_leads",
    label: "Captura de leads",
    description: "Foco em opt-in com lead magnet e formulário.",
  },
  {
    id: "webinar",
    label: "Webinar",
    description: "Convite, agenda do evento e registro.",
  },
  {
    id: "produto_digital",
    label: "Produto digital",
    description: "Oferta, bônus, garantia e checkout.",
  },
];

export const LANDING_AI_CONTEXT = `Você é a Aura Landing Builder — páginas de vendas de alta conversão para mercados globais.
Gere landing pages completas no idioma e cultura do mercado alvo.
Copy persuasiva, hierarquia visual clara e CTAs fortes.`;

export const LANDING_IA_ACTIONS = [
  {
    id: "criar-landing",
    label: "Criar landing",
    prompt: "Crie uma landing page completa para meu produto.",
  },
  {
    id: "melhorar-pagina",
    label: "Melhorar página",
    prompt: "Melhore essa página de vendas — headline, benefícios e CTA.",
  },
  {
    id: "otimizar-conversao",
    label: "Otimizar conversão",
    prompt: "Otimize a conversão desta landing page.",
  },
] as const;

const LANDING_CREATE_PHRASES = [
  "crie uma landing",
  "criar uma landing",
  "crie landing",
  "criar landing",
  "gere uma landing",
  "gerar uma landing",
] as const;

const LANDING_IMPROVE_PHRASES = [
  "melhore essa pagina",
  "melhorar essa pagina",
  "melhore essa página",
  "melhorar essa página",
  "melhore a pagina",
  "melhore a página",
] as const;

const LANDING_OPTIMIZE_PHRASES = [
  "otimize a conversao",
  "otimizar a conversao",
  "otimize a conversão",
  "otimizar a conversão",
  "otimize conversao",
  "otimizar conversão",
] as const;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesAny(normalized: string, phrases: readonly string[]): boolean {
  return phrases.some((p) => normalized.includes(normalize(p)));
}

export type LandingCoachMode = "landing-create" | "landing-improve" | "landing-optimize";

export function detectLandingCoachMode(message: string): LandingCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, LANDING_OPTIMIZE_PHRASES)) return "landing-optimize";
  if (matchesAny(normalized, LANDING_IMPROVE_PHRASES)) return "landing-improve";
  if (matchesAny(normalized, LANDING_CREATE_PHRASES)) return "landing-create";
  return null;
}

export function intakeFromProductBundle(
  bundle: CreatorProductBundle,
  modelo: LandingModelo = "pagina_simples"
): LandingIntake {
  const { product } = bundle;
  const preco = product.faixa_preco_max ?? product.faixa_preco_min ?? null;

  return {
    nome: product.nome ?? "",
    avatar: product.avatar ?? "",
    problema: product.problema ?? "",
    solucao: product.solucao ?? "",
    promessa: product.promessa ?? "",
    diferencial: product.diferenciais ?? "",
    preco,
    product_id: product.id,
    copylab_id: null,
    modelo,
    ...localeFieldsFromSource(product),
  };
}

export function parseDepoimentos(json: unknown): LandingDepoimento[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter(
      (item): item is LandingDepoimento =>
        typeof item === "object" &&
        item !== null &&
        "nome" in item &&
        "texto" in item &&
        typeof (item as LandingDepoimento).nome === "string" &&
        typeof (item as LandingDepoimento).texto === "string"
    )
    .map((d) => ({
      nome: d.nome,
      texto: d.texto,
      resultado: typeof d.resultado === "string" ? d.resultado : undefined,
    }));
}

export function parseFaq(json: unknown): LandingFaqItem[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter(
      (item): item is LandingFaqItem =>
        typeof item === "object" &&
        item !== null &&
        "pergunta" in item &&
        "resposta" in item &&
        typeof (item as LandingFaqItem).pergunta === "string" &&
        typeof (item as LandingFaqItem).resposta === "string"
    )
    .map((f) => ({ pergunta: f.pergunta, resposta: f.resposta }));
}

export function computeLandingDashboard(records: CreatorLanding[]): LandingDashboardMetrics {
  const ultimo = records[0];
  const comFaq = records.filter((r) => parseFaq(r.faq).length > 0).length;
  const modelos = new Set(records.map((r) => r.modelo)).size;
  const vinculados = records.filter((r) => r.product_id).length;

  return {
    totalLandings: records.length,
    ultimoProduto: ultimo?.nome ?? "—",
    comFaq,
    modelosUsados: modelos,
    vinculados,
  };
}

export function buildLandingAuraContext(records: CreatorLanding[]): string {
  if (records.length === 0) return "Nenhuma landing gerada no Landing Builder.";

  return records
    .slice(0, 5)
    .map((r) => {
      const modelo = LANDING_MODELS.find((m) => m.id === r.modelo)?.label ?? r.modelo;
      return `• ${r.nome ?? "Produto"} — ${modelo} · headline: ${r.headline?.slice(0, 40) ?? "—"}`;
    })
    .join("\n");
}

export function getModeloLabel(modelo: LandingModelo): string {
  return LANDING_MODELS.find((m) => m.id === modelo)?.label ?? modelo;
}

export function buildLandingCoachReply(params: {
  mode: LandingCoachMode;
  displayName: string;
  records: CreatorLanding[];
  bundles: CreatorProductBundle[];
}): string {
  const { mode, displayName, records, bundles } = params;
  const greeting = displayName ? `${displayName}, ` : "";

  if (mode === "landing-create") {
    const latest = records[0];
    if (latest?.headline) {
      return `${greeting}você já tem uma landing para **${latest.nome ?? "seu produto"}**.

**Headline:** ${latest.headline}

**Modelo:** ${getModeloLabel(latest.modelo)}

Abra **Aura Landing Builder** (/dashboard/creator/landing) para editar ou criar nova versão.`;
    }

    const product = bundles[0]?.product;
    return `${greeting}ainda não há landing page gerada.

${product ? `Produto disponível: **${product.nome}**` : "Crie um produto no Creator primeiro."}

1. Abra **Aura Landing Builder** → /dashboard/creator/landing
2. Escolha o modelo (simples, longa, captura, webinar ou produto digital)
3. Clique em **Gerar landing**`;
  }

  if (mode === "landing-improve") {
    const latest = records[0];
    if (latest) {
      return `${greeting}para melhorar a landing de **${latest.nome ?? "produto"}**:

1. Abra **Landing Builder** (/dashboard/creator/landing)
2. Selecione a landing no histórico
3. Use **Melhorar página** — a IA refina headline, benefícios, copy e CTA

**Headline atual:** ${latest.headline ?? "—"}`;
    }

    return `${greeting}primeiro gere uma landing em **Aura Landing Builder** (/dashboard/creator/landing), depois use "Melhorar página".`;
  }

  if (mode === "landing-optimize") {
    const latest = records[0];
    if (latest) {
      return `${greeting}para otimizar conversão de **${latest.nome ?? "produto"}**:

1. Abra **Landing Builder** (/dashboard/creator/landing)
2. Clique em **Otimizar conversão**
3. A IA ajusta hierarquia, CTAs, FAQ e prova social

**CTA atual:** ${latest.cta ?? "—"}`;
    }

    return `${greeting}gere uma landing primeiro em /dashboard/creator/landing, depois use "Otimize a conversão".`;
  }

  return `${greeting}abra o Landing Builder em /dashboard/creator/landing.`;
}

export { formatBRL };
