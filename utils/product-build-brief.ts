import type { OpportunityRecommendation } from "@/lib/opportunity/opportunity-types";
import type { ProductStrategyType } from "@/lib/product-strategist/product-strategist-types";
import type { ProductStrategyRecommendation } from "@/lib/product-strategist/product-strategist-types";
import type { ProductFactory, ProductFactoryType } from "@/types/database";
import type { MasterFlowMetadata } from "@/utils/master-flow";
import type { ProductFactoryIntake } from "@/utils/product-factory";
import { parseJsonArray } from "@/utils/product-factory";

export const PRODUCT_STRATEGY_MISSING_ERROR =
  "Product Strategy ausente. Não é seguro criar produto.";

export type ProductBuildBrief = {
  objective: string;
  niche: string;
  avatar: string;
  problem: string;
  selected_strategy_type: ProductStrategyType;
  selected_strategy_name: string;
  ticket: number;
  estimated_launch_time: number;
  margin: number;
  reason: string;
  opportunity_score: number;
  validation_score: number;
  strategist_score: number;
};

export type StrategyFactoryProfile = {
  product_type: ProductFactoryType;
  depth: "light" | "medium" | "deep";
  format: string;
  suggested_price: number;
  bonus_style: string;
  promise_style: string;
  transformation: string;
  modules_hint: string;
  communication_tone: string;
  complexity: "low" | "medium" | "high";
};

export type ProductStrategyAdherence = {
  score: number;
  aligned: boolean;
  pendencies: string[];
};

export function buildProductBuildBrief(input: {
  meta: MasterFlowMetadata;
  opportunity?: OpportunityRecommendation | null;
  strategy?: ProductStrategyRecommendation | null;
}): ProductBuildBrief | null {
  const strategy = input.strategy ?? input.meta.selected_strategy ?? null;
  if (!strategy) return null;

  const opportunity = input.opportunity ?? input.meta.selected_opportunity ?? null;

  return {
    objective:
      input.meta.user_intent ??
      opportunity?.title ??
      `Construir ${strategy.strategyName} em ${input.meta.niche ?? "mercado digital"}`,
    niche: input.meta.niche ?? opportunity?.niche ?? "Mercado digital",
    avatar: input.meta.avatar ?? opportunity?.avatar ?? "Empreendedor digital",
    problem:
      opportunity?.problem ??
      `Resolver desafios em ${input.meta.niche ?? "mercado digital"}`,
    selected_strategy_type: strategy.strategyType,
    selected_strategy_name: strategy.strategyName,
    ticket: strategy.ticket,
    estimated_launch_time: strategy.estimatedLaunchTime,
    margin: strategy.estimatedMargin,
    reason: strategy.reason,
    opportunity_score:
      opportunity?.opportunityScore.total ?? input.meta.opportunity_engine_score ?? 0,
    validation_score: input.meta.validation_score ?? 0,
    strategist_score: strategy.scores.total ?? input.meta.product_strategist_score ?? 0,
  };
}

export function resolveStrategyFactoryProfile(brief: ProductBuildBrief): StrategyFactoryProfile {
  switch (brief.selected_strategy_type) {
    case "kit_premium":
      return {
        product_type: "checklist",
        depth: "light",
        format: "kit premium com templates, checklists e prompt pack",
        suggested_price: brief.ticket,
        bonus_style: "modelos editáveis, swipe files e templates extras",
        promise_style: "aplicação imediata em minutos, alto valor percebido",
        transformation: "execução rápida sem curso longo",
        modules_hint: "8 a 12 seções acionáveis — NÃO gerar curso ou e-book narrativo",
        communication_tone: "direto, prático e objetivo",
        complexity: "low",
      };
    case "curso_online":
      return {
        product_type: "mini_curso",
        depth: "deep",
        format: "curso online modular com aulas, exercícios e plano de aprendizado",
        suggested_price: brief.ticket,
        bonus_style: "materiais complementares, gabaritos e planilhas de acompanhamento",
        promise_style: "transformação completa com progressão pedagógica",
        transformation: "domínio progressivo do tema com prática guiada",
        modules_hint: "4 a 6 módulos/aulas com exercícios em cada módulo",
        communication_tone: "didático, transformacional e encorajador",
        complexity: "high",
      };
    case "comunidade":
      return {
        product_type: "plano_30_dias",
        depth: "medium",
        format: "estrutura recorrente mensal com onboarding e calendário de conteúdo",
        suggested_price: brief.ticket,
        bonus_style: "acesso a encontros mensais, desafios da comunidade e biblioteca viva",
        promise_style: "pertencimento, consistência e evolução contínua",
        transformation: "hábito e recorrência com suporte da comunidade",
        modules_hint: "30 dias de conteúdo + estrutura de onboarding e calendário mensal",
        communication_tone: "acolhedor, comunitário e consistente",
        complexity: "medium",
      };
    case "mentoria":
      return {
        product_type: "workbook",
        depth: "deep",
        format: "programa premium com sessões, diagnóstico e acompanhamento",
        suggested_price: brief.ticket,
        bonus_style: "roteiros de sessão, diagnósticos e entregáveis premium",
        promise_style: "acompanhamento personalizado e resultado de alto ticket",
        transformation: "clareza estratégica com plano de implementação premium",
        modules_hint: "6 a 8 módulos com exercícios guiados, diagnóstico e plano de sessões",
        communication_tone: "premium, consultivo e personalizado",
        complexity: "high",
      };
    case "desafio":
      return {
        product_type: "plano_7_dias",
        depth: "light",
        format: "desafio curto com dias definidos e tarefas diárias",
        suggested_price: brief.ticket,
        bonus_style: "checklist diário, lembretes e certificado de conclusão",
        promise_style: "resultado rápido em 7 dias com ações claras",
        transformation: "vitória rápida e momentum inicial",
        modules_hint: "exatamente 7 dias com tarefa diária objetiva",
        communication_tone: "energético, urgente e motivador",
        complexity: "low",
      };
    default:
      return {
        product_type: "guia_pratico",
        depth: "medium",
        format: "guia prático executável",
        suggested_price: brief.ticket,
        bonus_style: "recursos complementares",
        promise_style: "resultado prático",
        transformation: "implementação guiada",
        modules_hint: "5 a 7 capítulos práticos",
        communication_tone: "claro e profissional",
        complexity: "medium",
      };
  }
}

function buildPromiseFromBrief(
  brief: ProductBuildBrief,
  profile: StrategyFactoryProfile
): string {
  return `${profile.promise_style}: ${profile.transformation} para ${brief.avatar} em ${brief.niche}.`;
}

export function applyBriefToIntake(
  intake: ProductFactoryIntake,
  brief: ProductBuildBrief,
  profile: StrategyFactoryProfile
): ProductFactoryIntake {
  const titulo = intake.titulo.trim()
    ? intake.titulo
    : `${brief.selected_strategy_name} — ${brief.niche}`;

  return {
    ...intake,
    titulo,
    subtitulo: intake.subtitulo ?? `${profile.format} · Ticket R$ ${brief.ticket}`,
    promessa: buildPromiseFromBrief(brief, profile),
    avatar: brief.avatar,
    publico: brief.avatar,
    objetivo: brief.objective,
    problema: brief.problem,
    solucao: `${brief.selected_strategy_name} estruturado para ${brief.niche}`,
    product_type: profile.product_type,
    build_brief: brief,
  };
}

export function buildBriefSystemPromptBlock(
  brief: ProductBuildBrief,
  profile: StrategyFactoryProfile
): string {
  return `
ESTRATÉGIA DE PRODUTO OBRIGATÓRIA (Product Strategist — NÃO IGNORAR):
- Tipo estratégico: ${brief.selected_strategy_name} (${brief.selected_strategy_type})
- Formato exigido: ${profile.format}
- Profundidade: ${profile.depth}
- Ticket sugerido: R$ ${brief.ticket}
- Tempo de lançamento alvo: ${brief.estimated_launch_time} dias
- Margem alvo: ${brief.margin}%
- Motivo da escolha: ${brief.reason}
- Bônus: ${profile.bonus_style}
- Promessa: ${profile.promise_style}
- Transformação: ${profile.transformation}
- Módulos: ${profile.modules_hint}
- Tom: ${profile.communication_tone}
- Complexidade: ${profile.complexity}
- Scores: opportunity ${brief.opportunity_score}, validation ${brief.validation_score}, strategist ${brief.strategist_score}

REGRAS DE ADERÊNCIA:
- O produto DEVE obedecer ao tipo "${brief.selected_strategy_type}".
- NÃO converta kit em curso longo nem desafio em e-book narrativo.
- Preço e promessa devem refletir ticket R$ ${brief.ticket}.
- Avatar: ${brief.avatar} | Problema: ${brief.problem}`;
}

export function evaluateStrategyAdherence(
  brief: ProductBuildBrief,
  factory: Pick<ProductFactory, "product_type" | "capitulos" | "titulo" | "conteudo" | "exercicios" | "bonus">
): ProductStrategyAdherence {
  const profile = resolveStrategyFactoryProfile(brief);
  const pendencies: string[] = [];
  let score = 100;

  const chapters = parseJsonArray(factory.capitulos);
  const chapterCount = chapters.length;
  const contentText = JSON.stringify(factory.conteudo ?? {}).toLowerCase();
  const titleLower = (factory.titulo ?? "").toLowerCase();

  if (factory.product_type !== profile.product_type) {
    pendencies.push(
      `Tipo gerado (${factory.product_type}) difere do exigido pela estratégia (${profile.product_type}).`
    );
    score -= 25;
  }

  switch (brief.selected_strategy_type) {
    case "kit_premium": {
      const looksLikeCourse =
        factory.product_type === "mini_curso" ||
        factory.product_type === "ebook" ||
        titleLower.includes("curso") ||
        titleLower.includes("módulo");
      if (looksLikeCourse) {
        pendencies.push("Kit Premium não deve gerar curso ou e-book longo.");
        score -= 35;
      }
      if (chapterCount > 12) {
        pendencies.push("Kit deve ser enxuto (máximo 12 seções).");
        score -= 10;
      }
      break;
    }
    case "curso_online": {
      if (chapterCount < 4) {
        pendencies.push("Curso Online deve ter pelo menos 4 módulos/aulas.");
        score -= 25;
      }
      if (factory.product_type !== "mini_curso") {
        pendencies.push("Curso Online deve usar estrutura mini_curso com módulos.");
        score -= 20;
      }
      break;
    }
    case "comunidade": {
      const hasRecurrence =
        contentText.includes("mensal") ||
        contentText.includes("comunidade") ||
        contentText.includes("recorr") ||
        contentText.includes("assinatura");
      if (!hasRecurrence) {
        pendencies.push("Comunidade deve incluir estrutura recorrente e calendário mensal.");
        score -= 20;
      }
      if (chapterCount < 7) {
        pendencies.push("Comunidade precisa de calendário de conteúdo com múltiplas entregas.");
        score -= 10;
      }
      break;
    }
    case "mentoria": {
      const hasMentorship =
        contentText.includes("sess") ||
        contentText.includes("diagn") ||
        contentText.includes("acompanh") ||
        (factory.exercicios != null && parseJsonArray(factory.exercicios).length >= 6);
      if (!hasMentorship) {
        pendencies.push("Mentoria deve incluir sessões, diagnóstico ou acompanhamento.");
        score -= 20;
      }
      break;
    }
    case "desafio": {
      if (factory.product_type !== "plano_7_dias") {
        pendencies.push("Desafio deve usar estrutura plano_7_dias.");
        score -= 30;
      }
      if (chapterCount !== 7 && chapterCount > 0) {
        pendencies.push("Desafio deve ter exatamente 7 dias de tarefas.");
        score -= 15;
      }
      break;
    }
  }

  const finalScore = Math.max(0, Math.min(100, score));
  return {
    score: finalScore,
    aligned: finalScore >= 75 && pendencies.length === 0,
    pendencies,
  };
}

export function requiresProductStrategy(meta: MasterFlowMetadata): boolean {
  return !meta.selected_strategy;
}
