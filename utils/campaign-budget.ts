import { formatCreatorMoney, type CreatorCurrency } from "@/utils/creator-locale";

export type BudgetSource =
  | "money"
  | "ads"
  | "orchestration"
  | "launch"
  | null;

export type ResolvedUserBudget = {
  orcamento: number | null;
  source: BudgetSource;
  sourceId: string | null;
};

export const BUDGET_REQUIRED_MESSAGE =
  "Informe seu **Orçamento disponível** antes de pedir sugestões de investimento em campanhas.";

export function parseBudgetInput(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
  }
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function formatBudgetHint(
  orcamento: number | null,
  currency: CreatorCurrency = "BRL"
): string {
  if (orcamento == null || orcamento <= 0) {
    return "Defina quanto você pode investir em campanhas e produção.";
  }
  return buildBudgetSuggestion(orcamento, currency);
}

export function buildBudgetSuggestion(orcamento: number, currency: CreatorCurrency = "BRL"): string {
  const fmt = (v: number) => formatCreatorMoney(v, { currency });
  if (orcamento < 500) {
    return `Com ${fmt(orcamento)}, recomendo teste pequeno — 1 criativo e 1 público por 7–14 dias.`;
  }
  if (orcamento < 1500) {
    return `Com ${fmt(orcamento)}, recomendo teste pequeno com 1–2 criativos e remarketing básico.`;
  }
  if (orcamento < 3000) {
    return `Com ${fmt(orcamento)}, recomendo 3 criativos e 2 públicos para validação.`;
  }
  if (orcamento < 8000) {
    return `Com ${fmt(orcamento)}, recomendo estrutura de validação com escala gradual.`;
  }
  return `Com ${fmt(orcamento)}, recomendo estrutura de validação + escala com múltiplos conjuntos.`;
}

export function inferBudgetTier(orcamento: number): "baixo" | "medio" | "escala" {
  if (orcamento < 1000) return "baixo";
  if (orcamento < 4000) return "medio";
  return "escala";
}

export function computeInvestimentoFromBudget(orcamento: number): {
  orcamento_nivel: "baixo" | "medio" | "escala";
  investimento_diario_min: number;
  investimento_diario_max: number;
  investimento_mensal_previsto: number;
} {
  const mensal = Math.round(orcamento * 100) / 100;
  const diarioMax = Math.max(10, Math.round((mensal / 30) * 100) / 100);
  const diarioMin = Math.max(5, Math.round(diarioMax * 0.4 * 100) / 100);

  return {
    orcamento_nivel: inferBudgetTier(mensal),
    investimento_diario_min: diarioMin,
    investimento_diario_max: diarioMax,
    investimento_mensal_previsto: mensal,
  };
}

export function buildBudgetAiRules(
  orcamento: number | null | undefined,
  currency: CreatorCurrency = "BRL"
): string {
  const fmt = (v: number) => formatCreatorMoney(v, { currency });
  if (orcamento == null || orcamento <= 0) {
    return `ORÇAMENTO:
- O usuário NÃO informou orçamento disponível.
- NÃO assuma valores padrão em ${currency}.
- NÃO sugira valores específicos de investimento.
- Peça que informe o "Orçamento disponível" antes de recomendar gastos em campanhas.`;
  }

  const inv = computeInvestimentoFromBudget(orcamento);
  return `ORÇAMENTO (OBRIGATÓRIO — use APENAS estes valores):
- Orçamento disponível informado pelo usuário: ${fmt(orcamento)} (${currency})
- investimento_mensal_previsto / investimento_necessario: no máximo ${fmt(orcamento)}
- Faixa diária sugerida: ${fmt(inv.investimento_diario_min)} a ${fmt(inv.investimento_diario_max)}
- Nível: ${inv.orcamento_nivel}
- ${buildBudgetSuggestion(orcamento, currency)}
- NUNCA use valores que o usuário não informou.`;
}

export function clampInvestimentoToBudget(
  value: number | null | undefined,
  orcamento: number | null | undefined
): number | null {
  if (value == null || Number.isNaN(value)) return null;
  if (orcamento == null || orcamento <= 0) return Math.round(value * 100) / 100;
  return Math.min(Math.round(value * 100) / 100, orcamento);
}

export function mentionsCampaignInvestment(message: string): boolean {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return (
    normalized.includes("investir") ||
    normalized.includes("investimento") ||
    normalized.includes("orcamento") ||
    normalized.includes("quanto gastar") ||
    normalized.includes("campanha") ||
    normalized.includes("anuncio") ||
    normalized.includes("ads") ||
    normalized.includes("trafego")
  );
}

export function buildBudgetAskReply(displayName?: string): string {
  const name = displayName?.split(" ")[0];
  const prefix = name ? `${name}, ` : "";
  return `${prefix}${BUDGET_REQUIRED_MESSAGE}

Defina o valor em **Money Missions**, **Ads Manager**, **Orchestrator** ou **Launch Center** no campo "Orçamento disponível".`;
}
