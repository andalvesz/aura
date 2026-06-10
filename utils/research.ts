import type { CreatorResearch } from "@/types/database";
import { LEGACY_CATEGORY_LABELS } from "@/utils/legado";
import type { LegacyData } from "@/utils/legado";
import {
  formatBRL,
  rankLegacyNiches,
  scoreNicheAlignment,
} from "@/utils/creator";
import {
  DEFAULT_CREATOR_LOCALE,
  formatCreatorMoney,
  type CreatorLocale,
} from "@/utils/creator-locale";

export type ResearchIntake = {
  ideia: string;
  nicho: string;
  publico: string;
  target_country: CreatorLocale["target_country"];
  target_language: CreatorLocale["target_language"];
  currency: CreatorLocale["currency"];
};

export type GeneratedMarketResearch = {
  nicho: string;
  publico: string;
  problema: string;
  solucao: string;
  concorrencia_analise: string;
  facilidade_criacao: number;
  facilidade_venda: number;
  demanda: number;
  competicao: number;
  escalabilidade: number;
  potencial_lucro: number;
  compatibilidade_perfil: number;
  nota_final: number;
  avatar: string;
  dores: string[];
  desejos: string[];
  objecoes: string[];
  produtos_concorrentes: string[];
  diferencial_sugerido: string;
  faixa_preco_min: number;
  faixa_preco_max: number;
};

export type ResearchDashboardMetrics = {
  totalAnalises: number;
  notaMedia: number;
  melhorOportunidade: string;
  convertidos: number;
};

export const RESEARCH_AI_CONTEXT = `Você é a Aura Market Research — valida oportunidades de mercado antes da criação de produtos digitais.
Avalie oportunidade considerando país de destino, idioma, moeda e cultura local.
Adapte avatar, dores, concorrência, preços e objeções ao mercado alvo.
Responda no idioma do produto, tom analítico e orientado a decisão.`;

export const RESEARCH_IA_ACTIONS = [
  {
    id: "analisar-ideia",
    label: "Analisar ideia",
    prompt: "Analise essa ideia de produto digital.",
  },
  {
    id: "nicho-vale",
    label: "Nicho vale a pena?",
    prompt: "Esse nicho vale a pena?",
  },
  {
    id: "produtos-mercado",
    label: "Produtos no mercado",
    prompt: "Quais produtos posso criar nesse mercado?",
  },
] as const;

const RESEARCH_ANALYZE_PHRASES = [
  "analise essa ideia",
  "analisar essa ideia",
  "analise minha ideia",
  "analisar minha ideia",
  "analise a ideia",
] as const;

const RESEARCH_NICHE_WORTH_PHRASES = [
  "esse nicho vale a pena",
  "nicho vale a pena",
  "vale a pena esse nicho",
  "vale a pena investir nesse nicho",
] as const;

const RESEARCH_PRODUCTS_PHRASES = [
  "quais produtos posso criar nesse mercado",
  "produtos posso criar nesse mercado",
  "quais produtos criar nesse mercado",
  "quais produtos posso criar",
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

export type ResearchCoachMode =
  | "research-analyze"
  | "research-niche"
  | "research-products";

export function detectResearchCoachMode(message: string): ResearchCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, RESEARCH_ANALYZE_PHRASES)) return "research-analyze";
  if (matchesAny(normalized, RESEARCH_NICHE_WORTH_PHRASES)) return "research-niche";
  if (matchesAny(normalized, RESEARCH_PRODUCTS_PHRASES)) return "research-products";
  return null;
}

export function parseJsonStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  return [];
}

export function computeResearchDashboard(
  records: CreatorResearch[]
): ResearchDashboardMetrics {
  const scored = records.filter((r) => r.nota_final != null);
  const best = [...scored].sort((a, b) => (b.nota_final ?? 0) - (a.nota_final ?? 0))[0];
  const avg =
    scored.length > 0
      ? Math.round(
          scored.reduce((sum, r) => sum + (r.nota_final ?? 0), 0) / scored.length
        )
      : 0;

  return {
    totalAnalises: records.length,
    notaMedia: avg,
    melhorOportunidade: best?.nicho ?? best?.ideia_input?.slice(0, 40) ?? "—",
    convertidos: records.filter((r) => r.product_id).length,
  };
}

export function buildResearchAuraContext(records: CreatorResearch[]): string {
  if (records.length === 0) return "Nenhuma pesquisa de mercado realizada.";

  return records
    .slice(0, 6)
    .map((r) => {
      const label = r.nicho ?? r.ideia_input?.slice(0, 50) ?? "Sem título";
      return `• ${label} · nota ${r.nota_final ?? "—"}/100${r.product_id ? " · convertido" : ""}`;
    })
    .join("\n");
}

export function buildResearchCoachReply(params: {
  mode: ResearchCoachMode;
  displayName: string;
  records: CreatorResearch[];
  legacyData: LegacyData;
  message?: string;
}): string {
  const { mode, displayName, records, legacyData, message } = params;
  const ranked = rankLegacyNiches(legacyData);
  const topLabel = ranked[0]
    ? LEGACY_CATEGORY_LABELS[ranked[0].categoria]
    : "empreendedorismo";

  const best = [...records]
    .filter((r) => r.nota_final != null)
    .sort((a, b) => (b.nota_final ?? 0) - (a.nota_final ?? 0))[0];

  if (mode === "research-analyze") {
    if (best) {
      return `Olá, ${displayName}!

**Última análise:** ${best.nicho ?? best.ideia_input ?? "—"}
• Nota: **${best.nota_final}/100**
• Demanda: ${best.demanda ?? "—"}/100 · Competição: ${best.competicao ?? "—"}/100
• Potencial de lucro: ${best.potencial_lucro ?? "—"}/100
• Compatibilidade com seu perfil: ${best.compatibilidade_perfil ?? "—"}/100

${best.nota_final != null && best.nota_final >= 70 ? "✅ Oportunidade promissora — considere criar o produto no Creator." : "⚠️ Valide mais antes de investir tempo na produção."}

Abra **Market Research** (/dashboard/creator/research) para nova análise ou converter em produto.`;
    }

    return `Olá, ${displayName}!

Para analisar uma ideia, abra **Aura Market Research** (/dashboard/creator/research).

Descreva: ideia, nicho e público-alvo. A IA gera scores, avatar, dores, concorrentes e faixa de preço.

${message ? `\nVocê mencionou: _"${message.slice(0, 120)}"_ — cole isso no formulário de pesquisa.` : ""}`;
  }

  if (mode === "research-niche") {
    const nicheFromMsg = message?.replace(/.*nicho\s*(?:de|:)?\s*/i, "").trim();
    const match = records.find(
      (r) =>
        nicheFromMsg &&
        r.nicho &&
        normalize(r.nicho).includes(normalize(nicheFromMsg.slice(0, 30)))
    );

    if (match) {
      const worth = (match.nota_final ?? 0) >= 65;
      return `Olá, ${displayName}!

**Nicho analisado:** ${match.nicho}
• Nota final: **${match.nota_final}/100**
• Demanda: ${match.demanda}/100 · Competição: ${match.competicao}/100
• Escalabilidade: ${match.escalabilidade}/100
• Compatibilidade Anderson: ${match.compatibilidade_perfil}/100
• Faixa de preço: ${formatBRL(match.faixa_preco_min)} – ${formatBRL(match.faixa_preco_max)}

**Veredicto:** ${worth ? "✅ Vale a pena — boa oportunidade alinhada ao mercado." : "⚠️ Cuidado — considere nichar mais ou ajustar posicionamento."}`;
    }

    const alignment = scoreNicheAlignment(nicheFromMsg ?? topLabel);
    return `Olá, ${displayName}!

**Nicho sugerido pelo Legado:** ${topLabel} (compatibilidade ~${alignment}/100)

Para saber se um nicho vale a pena:
1. Abra **Market Research** (/dashboard/creator/research)
2. Informe o nicho e público
3. A IA analisa demanda, competição e potencial de lucro

Áreas fortes: esporte, dança, teatro, desenvolvimento pessoal, empreendedorismo, bartender, IA.`;
  }

  const latest = records[0];
  if (latest?.produtos_concorrentes) {
    const competitors = parseJsonStringArray(latest.produtos_concorrentes);
    const ideas = competitors.length
      ? competitors.map((c) => `• Concorrente: ${c} → crie versão diferenciada com: _${latest.diferencial_sugerido ?? "seu diferencial único"}_`)
      : [];

    return `Olá, ${displayName}!

**Mercado:** ${latest.nicho ?? "—"}

**Produtos que você pode criar:**
• Curso/mentoria sobre: ${latest.problema ?? "problema identificado"}
• Formato sugerido com preço ${formatBRL(latest.faixa_preco_min)} – ${formatBRL(latest.faixa_preco_max)}
• Diferencial: ${latest.diferencial_sugerido ?? "—"}

**Concorrentes mapeados:**
${ideas.length > 0 ? ideas.join("\n") : "• Faça uma pesquisa em /dashboard/creator/research para mapear o mercado"}

**Avatar:** ${latest.avatar ?? "—"}`;
  }

  return `Olá, ${displayName}!

Para descobrir produtos viáveis em um mercado:

1. **Market Research** → informe nicho e ideia
2. A IA gera concorrentes, avatar, dores e faixa de preço
3. Se nota ≥ 70, clique **Criar produto no Creator**

Com base no Legado, comece explorando **${topLabel}**.`;
}

export { DEFAULT_CREATOR_LOCALE } from "@/utils/creator-locale";
export { formatBRL };
