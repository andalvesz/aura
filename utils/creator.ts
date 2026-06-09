import type {
  CreatorLaunch,
  CreatorOffer,
  CreatorProduct,
  CreatorValidation,
  LegacyCategoria,
} from "@/types/database";
import { LEGACY_CATEGORY_LABELS } from "@/utils/legado";
import type { LegacyData } from "@/utils/legado";

export type CreatorProductIntake = {
  nicho: string;
  conhecimento: string;
  publico_alvo: string;
  objetivo_financeiro: number | null;
  prazo: string;
};

export type GeneratedCreatorProduct = {
  nome: string;
  problema: string;
  solucao: string;
  avatar: string;
  publico_alvo: string;
  promessa: string;
  mecanismo_unico: string;
  diferenciais: string;
  faixa_preco_min: number;
  faixa_preco_max: number;
  formato: string;
  probabilidade_venda: number;
};

export type GeneratedCreatorValidation = {
  demanda: number;
  concorrencia: number;
  facilidade_criacao: number;
  facilidade_venda: number;
  escalabilidade: number;
  nota_final: number;
};

export type GeneratedCreatorOffer = {
  headline: string;
  subheadline: string;
  bullet_points: string[];
  garantia: string;
  bonus: string;
  cta: string;
};

export type CreatorProductBundle = {
  product: CreatorProduct;
  validation: CreatorValidation | null;
  offer: CreatorOffer | null;
  launch: CreatorLaunch | null;
};

export type CreatorDashboardMetrics = {
  produtosCriados: number;
  produtosValidados: number;
  melhorOportunidade: string;
  potencialEstimado: number;
};

export const CREATOR_AI_CONTEXT = `Você é a Aura Creator — especialista em criar e validar produtos digitais.
Use dados reais da Aura (Legado, produtos já criados) quando disponíveis.
Responda em português do Brasil, tom estratégico e orientado a lançamento.
Áreas fortes de Anderson: ginástica, dança, teatro, desenvolvimento pessoal, marketing, bartender, empreendedorismo (Alvesz), tecnologia (Aura).`;

export const CREATOR_IA_ACTIONS = [
  {
    id: "sugerir-produto",
    label: "Sugerir produto",
    prompt: "Com base na minha trajetória, sugira um produto digital para eu criar.",
  },
  {
    id: "validar-ideia",
    label: "Validar ideia",
    prompt: "Tenho uma ideia de produto — me ajude a validar demanda e posicionamento.",
  },
  {
    id: "melhor-lancamento",
    label: "Melhor lançamento",
    prompt: "Qual produto devo lançar primeiro com base nos meus dados?",
  },
] as const;

export const CREATOR_NICHE_SUGGESTIONS = [
  "Ginástica",
  "Dança",
  "Teatro",
  "Desenvolvimento pessoal",
  "Marketing",
  "Bartender",
  "Empreendedorismo",
] as const;

const CREATOR_PRODUCT_PHRASES = [
  "crie um produto para mim",
  "criar um produto para mim",
  "criar produto para mim",
  "quero criar um produto",
] as const;

const CREATOR_LAUNCH_PHRASES = [
  "qual produto devo lancar",
  "qual produto devo lançar",
  "que produto devo lancar",
  "que produto devo lançar",
  "qual produto lancar",
] as const;

const CREATOR_NICHE_PHRASES = [
  "qual meu nicho mais forte",
  "meu nicho mais forte",
  "qual e meu nicho",
  "qual é meu nicho",
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

export type CreatorCoachMode = "creator-product" | "creator-launch" | "creator-niche";

export function detectCreatorCoachMode(message: string): CreatorCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, CREATOR_PRODUCT_PHRASES)) return "creator-product";
  if (matchesAny(normalized, CREATOR_LAUNCH_PHRASES)) return "creator-launch";
  if (matchesAny(normalized, CREATOR_NICHE_PHRASES)) return "creator-niche";
  return null;
}

export function computeCreatorDashboard(
  bundles: CreatorProductBundle[]
): CreatorDashboardMetrics {
  const validated = bundles.filter((b) => b.validation);
  const best = [...validated].sort(
    (a, b) => (b.validation?.nota_final ?? 0) - (a.validation?.nota_final ?? 0)
  )[0];

  const potencialTotal = bundles.reduce((sum, b) => {
    const pot = b.launch?.potencial_estimado ?? 0;
    return sum + Number(pot);
  }, 0);

  return {
    produtosCriados: bundles.length,
    produtosValidados: validated.length,
    melhorOportunidade: best?.product.nome ?? "—",
    potencialEstimado: Math.round(potencialTotal),
  };
}

export function buildCreatorAuraContext(bundles: CreatorProductBundle[]): string {
  if (bundles.length === 0) {
    return "Nenhum produto digital criado ainda.";
  }

  return bundles
    .slice(0, 8)
    .map((b) => {
      const v = b.validation;
      const score = v ? ` · validação ${v.nota_final}/100` : "";
      return `• ${b.product.nome ?? "Sem nome"} (${b.product.status})${score}`;
    })
    .join("\n");
}

export function rankLegacyNiches(data: LegacyData): { categoria: LegacyCategoria; count: number }[] {
  const counts = new Map<LegacyCategoria, number>();

  for (const item of [
    ...data.timeline,
    ...data.achievements,
    ...data.certificates,
    ...data.lifeEvents,
    ...data.milestones,
  ]) {
    counts.set(item.categoria, (counts.get(item.categoria) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([categoria, count]) => ({ categoria, count }))
    .sort((a, b) => b.count - a.count);
}

export function buildCreatorCoachReply(params: {
  mode: CreatorCoachMode;
  displayName: string;
  bundles: CreatorProductBundle[];
  legacyData: LegacyData;
}): string {
  const { mode, displayName, bundles, legacyData } = params;
  const ranked = rankLegacyNiches(legacyData);
  const topNiche = ranked[0];
  const topLabel = topNiche
    ? LEGACY_CATEGORY_LABELS[topNiche.categoria]
    : "empreendedorismo";

  const bestValidated = [...bundles]
    .filter((b) => b.validation)
    .sort((a, b) => (b.validation?.nota_final ?? 0) - (a.validation?.nota_final ?? 0))[0];

  if (mode === "creator-niche") {
    const lines = ranked.slice(0, 4).map(
      (r) => `• **${LEGACY_CATEGORY_LABELS[r.categoria]}** — ${r.count} registro(s) no Legado`
    );
    return `Olá, ${displayName}!

**Seu nicho mais forte (dados do Legado):** ${topLabel}

${lines.length > 0 ? lines.join("\n") : "• Importe sua trajetória no módulo Legado para análise completa."}

**Sugestão:** transforme essa expertise em produto digital no **Aura Creator** (/dashboard/creator).`;
  }

  if (mode === "creator-launch") {
    if (bestValidated) {
      return `Olá, ${displayName}!

**Produto recomendado para lançar:** **${bestValidated.product.nome}**
• Nota de validação: **${bestValidated.validation!.nota_final}/100**
• Formato: ${bestValidated.product.formato ?? "—"}
• Probabilidade de venda: ${bestValidated.product.probabilidade_venda ?? "—"}%

Abra **Aura Creator** para gerar ou revisar a oferta de lançamento.`;
    }

    return `Olá, ${displayName}!

Ainda não há produtos validados. Com base no Legado, comece por **${topLabel}**.

1. Abra **Aura Creator** → Criar Produto
2. Use **"Use meus dados da Aura"**
3. Valide e gere a oferta

Sugestões de nicho: ${CREATOR_NICHE_SUGGESTIONS.join(", ")}.`;
  }

  return `Olá, ${displayName}!

Vou te ajudar a criar um produto digital.

**Sugestão com base no Legado:** produto sobre **${topLabel}** — sua área com mais registros de trajetória.

**Próximo passo:** abra **Aura Creator** (/dashboard/creator) → **Criar Produto** → **Use meus dados da Aura**.

Ou informe: nicho, conhecimento, público, objetivo financeiro e prazo.`;
}

export function parseBulletPoints(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  return [];
}

export function formatBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}
