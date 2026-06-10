import type { CreatorCopylab } from "@/types/database";
import type { CreatorProductBundle } from "@/utils/creator";
import { formatBRL } from "@/utils/creator";
import type { CreatorLocalePartial } from "@/utils/creator-locale";
import { parseJsonStringArray } from "@/utils/research";

export type CopylabIntake = {
  nome: string;
  avatar: string;
  problema: string;
  solucao: string;
  promessa: string;
  diferencial: string;
  preco: number | null;
  product_id?: string | null;
} & CreatorLocalePartial;

export type GeneratedCopylab = {
  headline: string;
  subheadline: string;
  big_idea: string;
  mecanismo_unico: string;
  bullets: string[];
  garantia: string;
  bonus: string;
  cta: string;
  pagina_vendas: string;
  estrutura_vsl: string;
  storytelling: string;
  email_lancamento: string;
  whatsapp_venda: string;
  instagram_post: string;
  facebook_ad: string;
  google_ad: string;
};

export type CopylabDashboardMetrics = {
  totalCopies: number;
  ultimoProduto: string;
  comVsl: number;
  vinculados: number;
};

export const COPYLAB_AI_CONTEXT = `Você é a Aura CopyLab — copywriting e comunicação de vendas para produtos digitais globais.
Gere copy no idioma do produto, adaptada ao país e cultura do mercado alvo.
Headlines magnéticas, ofertas irresistíveis, VSLs, storytelling e criativos para tráfego pago.`;

export const COPYLAB_IA_ACTIONS = [
  {
    id: "criar-copy",
    label: "Criar copy",
    prompt: "Crie a copy completa para meu produto.",
  },
  {
    id: "melhorar-oferta",
    label: "Melhorar oferta",
    prompt: "Melhore essa oferta — headline, bullets e CTA.",
  },
  {
    id: "criar-vsl",
    label: "Criar VSL",
    prompt: "Crie uma VSL com estrutura completa para meu produto.",
  },
] as const;

const COPYLAB_CREATE_PHRASES = [
  "crie a copy",
  "criar a copy",
  "crie copy",
  "criar copy",
  "gere a copy",
  "gerar a copy",
] as const;

const COPYLAB_IMPROVE_PHRASES = [
  "melhore essa oferta",
  "melhorar essa oferta",
  "melhore a oferta",
  "melhorar a oferta",
  "melhore minha oferta",
] as const;

const COPYLAB_VSL_PHRASES = [
  "crie uma vsl",
  "criar uma vsl",
  "crie vsl",
  "criar vsl",
  "gere uma vsl",
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

export type CopylabCoachMode = "copylab-create" | "copylab-improve" | "copylab-vsl";

export function detectCopylabCoachMode(message: string): CopylabCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, COPYLAB_VSL_PHRASES)) return "copylab-vsl";
  if (matchesAny(normalized, COPYLAB_IMPROVE_PHRASES)) return "copylab-improve";
  if (matchesAny(normalized, COPYLAB_CREATE_PHRASES)) return "copylab-create";
  return null;
}

export function intakeFromProductBundle(bundle: CreatorProductBundle): CopylabIntake {
  const { product } = bundle;
  const preco =
    product.faixa_preco_max ?? product.faixa_preco_min ?? null;

  return {
    nome: product.nome ?? "",
    avatar: product.avatar ?? "",
    problema: product.problema ?? "",
    solucao: product.solucao ?? "",
    promessa: product.promessa ?? "",
    diferencial: product.diferenciais ?? product.mecanismo_unico ?? "",
    preco,
    product_id: product.id,
  };
}

export function computeCopylabDashboard(
  records: CreatorCopylab[]
): CopylabDashboardMetrics {
  const latest = records[0];
  return {
    totalCopies: records.length,
    ultimoProduto: latest?.nome ?? "—",
    comVsl: records.filter((r) => r.estrutura_vsl?.trim()).length,
    vinculados: records.filter((r) => r.product_id).length,
  };
}

export function buildCopylabAuraContext(records: CreatorCopylab[]): string {
  if (records.length === 0) return "Nenhuma copy gerada no CopyLab.";

  return records
    .slice(0, 6)
    .map((r) => {
      const label = r.nome ?? r.headline?.slice(0, 50) ?? "Sem título";
      return `• ${label}${r.product_id ? " · vinculado" : ""}`;
    })
    .join("\n");
}

export function buildCopylabCoachReply(params: {
  mode: CopylabCoachMode;
  displayName: string;
  records: CreatorCopylab[];
  bundles: CreatorProductBundle[];
  message?: string;
}): string {
  const { mode, displayName, records, bundles, message } = params;
  const latest = records[0];
  const latestProduct = bundles[0]?.product;

  if (mode === "copylab-create") {
    if (latest) {
      const bullets = parseJsonStringArray(latest.bullets);
      return `Olá, ${displayName}!

**Última copy:** ${latest.nome ?? latest.headline ?? "—"}

**Headline:** ${latest.headline ?? "—"}
**Subheadline:** ${latest.subheadline ?? "—"}
**Big Idea:** ${latest.big_idea ?? "—"}
**CTA:** ${latest.cta ?? "—"}

${bullets.length > 0 ? `**Bullets:**\n${bullets.map((b) => `• ${b}`).join("\n")}` : ""}

Abra **Aura CopyLab** (/dashboard/creator/copy) para gerar nova copy ou vincular a um produto do Creator.`;
    }

    if (latestProduct) {
      return `Olá, ${displayName}!

Você tem o produto **${latestProduct.nome ?? "sem nome"}** no Creator.

Abra **Aura CopyLab** (/dashboard/creator/copy) e use os dados do produto para gerar:
• Headline, subheadline, big idea, bullets, garantia, bônus, CTA
• Página de vendas, VSL, storytelling
• E-mail, WhatsApp, Instagram, Facebook e Google Ads

${message ? `\nVocê pediu: _"${message.slice(0, 120)}"_` : ""}`;
    }

    return `Olá, ${displayName}!

Para criar copy completa:

1. Abra **Aura CopyLab** (/dashboard/creator/copy)
2. Informe nome, avatar, problema, solução, promessa, diferencial e preço
3. A IA gera toda a comunicação do produto

Ou vincule um produto já criado no Creator.`;
  }

  if (mode === "copylab-improve") {
    if (latest) {
      return `Olá, ${displayName}!

**Oferta atual:** ${latest.nome ?? "—"}

**Headline:** ${latest.headline ?? "—"}
**Garantia:** ${latest.garantia ?? "—"}
**Bônus:** ${latest.bonus ?? "—"}
**Preço:** ${latest.preco != null ? formatBRL(latest.preco) : "—"}

**Sugestões de melhoria:**
• Reforce a promessa na headline com resultado específico
• Adicione prova social ou mecanismo único nos bullets
• CTA com urgência e benefício claro

Abra **CopyLab** (/dashboard/creator/copy) e gere uma nova versão com "Melhorar oferta" na IA.`;
    }

    return `Olá, ${displayName}!

Para melhorar uma oferta, primeiro gere a copy em **Aura CopyLab** (/dashboard/creator/copy).

Depois use o botão **Melhorar oferta** na IA do módulo.`;
  }

  if (latest?.estrutura_vsl) {
    return `Olá, ${displayName}!

**VSL — ${latest.nome ?? "Produto"}**

${latest.estrutura_vsl.slice(0, 1200)}${latest.estrutura_vsl.length > 1200 ? "…" : ""}

**Storytelling:**
${latest.storytelling?.slice(0, 400) ?? "—"}

Veja a estrutura completa em /dashboard/creator/copy`;
  }

  if (latestProduct) {
    return `Olá, ${displayName}!

Para criar VSL do produto **${latestProduct.nome ?? "—"}**:

1. Abra **Aura CopyLab** (/dashboard/creator/copy)
2. Preencha os dados do produto
3. Clique **Gerar copy completa** — a IA gera estrutura de VSL + storytelling

Problema: ${latestProduct.problema ?? "—"}
Promessa: ${latestProduct.promessa ?? "—"}`;
  }

  return `Olá, ${displayName}!

Para criar uma VSL:

1. **Aura CopyLab** → /dashboard/creator/copy
2. Informe os dados do produto
3. A IA gera estrutura de VSL, storytelling e página de vendas

Ou diga "Crie a copy" após cadastrar o produto no Creator.`;
}

export { formatBRL, parseJsonStringArray };
