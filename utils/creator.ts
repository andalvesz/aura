import type {
  CreatorChecklistItem,
  CreatorLaunch,
  CreatorOffer,
  CreatorPipelineStage,
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
  investimento_previsto: number;
  receita_prevista: number;
};

export type GeneratedCreatorValidation = {
  viabilidade: number;
  lucro_potencial: number;
  tempo_lancar: number;
  compatibilidade_perfil: number;
  escalabilidade: number;
  nota_final: number;
  demanda: number;
  concorrencia: number;
  facilidade_criacao: number;
  facilidade_venda: number;
};

export type GeneratedCreatorOffer = {
  headline: string;
  subheadline: string;
  bullet_points: string[];
  garantia: string;
  bonus: string;
  cta: string;
};

export type GeneratedCreatorPlan = {
  titulo: string;
  semanas: {
    semana: number;
    foco: string;
    tarefas: string[];
  }[];
};

export type CreatorProductBundle = {
  product: CreatorProduct;
  validation: CreatorValidation | null;
  offer: CreatorOffer | null;
  launch: CreatorLaunch | null;
  checklist: CreatorChecklistItem[];
};

export type CreatorDashboardMetrics = {
  produtosCriados: number;
  produtosValidados: number;
  melhorOportunidade: string;
  potencialEstimado: number;
  roiMedio: number;
  emProducao: number;
};

export const CREATOR_PIPELINE_STAGES: {
  id: CreatorPipelineStage;
  label: string;
}[] = [
  { id: "ideia", label: "Ideia" },
  { id: "pesquisa", label: "Pesquisa" },
  { id: "validacao", label: "Validação" },
  { id: "producao", label: "Produção" },
  { id: "pagina_vendas", label: "Página de vendas" },
  { id: "criativos", label: "Criativos" },
  { id: "lancamento", label: "Lançamento" },
  { id: "trafego", label: "Tráfego" },
  { id: "escala", label: "Escala" },
];

export const CREATOR_CHECKLIST_TEMPLATES: Record<CreatorPipelineStage, string[]> = {
  ideia: [
    "Definir conceito do produto",
    "Mapear transformação prometida",
    "Escolher formato (curso, mentoria, ebook)",
  ],
  pesquisa: [
    "Definir avatar",
    "Definir dores",
    "Definir concorrentes",
  ],
  validacao: [
    "Validar demanda com pesquisa",
    "Testar preço com público",
    "Confirmar diferencial competitivo",
  ],
  producao: [
    "Criar conteúdo",
    "Criar bônus",
    "Criar garantia",
  ],
  pagina_vendas: [
    "Escrever headline e subheadline",
    "Montar estrutura da página",
    "Definir prova social",
  ],
  criativos: [
    "Criar roteiros de vídeo",
    "Produzir criativos para ads",
    "Preparar materiais para redes",
  ],
  lancamento: [
    "Criar landing page",
    "Criar copies",
    "Criar anúncios",
  ],
  trafego: [
    "Configurar campanhas pagas",
    "Ativar tráfego orgânico",
    "Monitorar métricas iniciais",
  ],
  escala: [
    "Otimizar funil de conversão",
    "Automatizar vendas",
    "Expandir canais de aquisição",
  ],
};

export const LEGACY_PRIORITY_NICHES: {
  keywords: string[];
  categoria: LegacyCategoria;
  weight: number;
}[] = [
  { keywords: ["esporte", "ginastica", "ginástica", "atletismo"], categoria: "ginastica", weight: 1.4 },
  { keywords: ["danca", "dança", "ballet"], categoria: "danca", weight: 1.4 },
  { keywords: ["teatro", "palco", "atuação", "atuacao"], categoria: "teatro", weight: 1.3 },
  {
    keywords: ["desenvolvimento pessoal", "mindset", "autoconhecimento"],
    categoria: "vida_pessoal",
    weight: 1.3,
  },
  {
    keywords: ["empreendedorismo", "negocio", "negócio", "alvesz"],
    categoria: "empreendedorismo",
    weight: 1.3,
  },
  { keywords: ["bartender", "drinks", "coquetelaria"], categoria: "vida_pessoal", weight: 1.2 },
  { keywords: ["ia", "inteligencia artificial", "produtividade", "aura"], categoria: "tecnologia", weight: 1.2 },
];

export const CREATOR_AI_CONTEXT = `Você é a Aura Creator — especialista em transformar ideias em projetos executáveis.
Use dados reais da Aura (Legado, produtos já criados, Financeiro) quando disponíveis.
Responda em português do Brasil, tom estratégico e orientado a lançamento.
Priorize nichos alinhados à trajetória de Anderson: esporte, dança, teatro, desenvolvimento pessoal, empreendedorismo, bartender, IA e produtividade.`;

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
    label: "Qual lançar agora?",
    prompt: "Qual produto devo lançar agora?",
  },
  {
    id: "maior-chance",
    label: "Maior chance de venda",
    prompt: "Qual produto tem maior chance de vender?",
  },
  {
    id: "plano-30-dias",
    label: "Plano 30 dias",
    prompt: "Crie um plano de 30 dias para lançar esse produto.",
  },
] as const;

export const CREATOR_NICHE_SUGGESTIONS = [
  "Esporte",
  "Dança",
  "Teatro",
  "Desenvolvimento pessoal",
  "Empreendedorismo",
  "Bartender",
  "IA e produtividade",
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
  "qual produto devo lancar agora",
  "qual produto devo lançar agora",
  "que produto devo lancar",
  "que produto devo lançar",
  "qual produto lancar",
] as const;

const CREATOR_BEST_SELLER_PHRASES = [
  "qual produto tem maior chance de vender",
  "maior chance de vender",
  "produto com maior chance",
  "qual vende mais",
] as const;

const CREATOR_PLAN_PHRASES = [
  "plano de 30 dias",
  "crie um plano de 30 dias",
  "criar plano de 30 dias",
  "planejamento de 30 dias",
  "plano para lancar",
  "plano para lançar",
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

export type CreatorCoachMode =
  | "creator-product"
  | "creator-launch"
  | "creator-best-seller"
  | "creator-plan"
  | "creator-niche";

export function detectCreatorCoachMode(message: string): CreatorCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, CREATOR_PRODUCT_PHRASES)) return "creator-product";
  if (matchesAny(normalized, CREATOR_PLAN_PHRASES)) return "creator-plan";
  if (matchesAny(normalized, CREATOR_BEST_SELLER_PHRASES)) return "creator-best-seller";
  if (matchesAny(normalized, CREATOR_LAUNCH_PHRASES)) return "creator-launch";
  if (matchesAny(normalized, CREATOR_NICHE_PHRASES)) return "creator-niche";
  return null;
}

export function getNextPipelineStage(
  current: CreatorPipelineStage
): CreatorPipelineStage | null {
  const idx = CREATOR_PIPELINE_STAGES.findIndex((s) => s.id === current);
  if (idx < 0 || idx >= CREATOR_PIPELINE_STAGES.length - 1) return null;
  return CREATOR_PIPELINE_STAGES[idx + 1]!.id;
}

export function getPipelineStageLabel(stage: CreatorPipelineStage): string {
  return CREATOR_PIPELINE_STAGES.find((s) => s.id === stage)?.label ?? stage;
}

export function computeChecklistProgress(
  items: CreatorChecklistItem[],
  stage?: CreatorPipelineStage
): { done: number; total: number; percent: number } {
  const filtered = stage ? items.filter((i) => i.estagio === stage) : items;
  const total = filtered.length;
  const done = filtered.filter((i) => i.status === "feito").length;
  return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
}

export function computeRoi(
  investimento: number | null | undefined,
  receita: number | null | undefined
): number | null {
  if (investimento == null || receita == null || investimento <= 0) return null;
  return Math.round(((receita - investimento) / investimento) * 100 * 10) / 10;
}

export function computeCreatorDashboard(
  bundles: CreatorProductBundle[]
): CreatorDashboardMetrics {
  const validated = bundles.filter((b) => b.validation);
  const best = [...validated].sort(
    (a, b) => (b.validation?.nota_final ?? 0) - (a.validation?.nota_final ?? 0)
  )[0];

  const potencialTotal = bundles.reduce((sum, b) => {
    const pot = b.launch?.potencial_estimado ?? b.product.receita_prevista ?? 0;
    return sum + Number(pot);
  }, 0);

  const rois = bundles
    .map((b) => b.product.roi_estimado)
    .filter((r): r is number => r != null && !Number.isNaN(r));
  const roiMedio =
    rois.length > 0 ? Math.round(rois.reduce((a, b) => a + b, 0) / rois.length) : 0;

  const emProducao = bundles.filter((b) =>
    ["producao", "pagina_vendas", "criativos", "lancamento"].includes(b.product.status)
  ).length;

  return {
    produtosCriados: bundles.length,
    produtosValidados: validated.length,
    melhorOportunidade: best?.product.nome ?? "—",
    potencialEstimado: Math.round(potencialTotal),
    roiMedio,
    emProducao,
  };
}

export function rankProductsBySalePotential(
  bundles: CreatorProductBundle[]
): CreatorProductBundle[] {
  return [...bundles].sort((a, b) => {
    const scoreA =
      (a.validation?.lucro_potencial ?? a.validation?.nota_final ?? a.product.probabilidade_venda ?? 0) *
      (a.validation?.compatibilidade_perfil ?? 70) *
      0.01;
    const scoreB =
      (b.validation?.lucro_potencial ?? b.validation?.nota_final ?? b.product.probabilidade_venda ?? 0) *
      (b.validation?.compatibilidade_perfil ?? 70) *
      0.01;
    return scoreB - scoreA;
  });
}

export function rankProductsForLaunch(
  bundles: CreatorProductBundle[]
): CreatorProductBundle[] {
  return [...bundles].sort((a, b) => {
    const stageOrder: Record<CreatorPipelineStage, number> = {
      lancamento: 100,
      trafego: 90,
      criativos: 80,
      pagina_vendas: 70,
      producao: 60,
      validacao: 50,
      pesquisa: 40,
      ideia: 30,
      escala: 10,
    };
    const stageA = stageOrder[a.product.status] ?? 0;
    const stageB = stageOrder[b.product.status] ?? 0;
    if (stageA !== stageB) return stageB - stageA;
    return (b.validation?.nota_final ?? 0) - (a.validation?.nota_final ?? 0);
  });
}

export function buildCreatorAuraContext(bundles: CreatorProductBundle[]): string {
  if (bundles.length === 0) {
    return "Nenhum produto digital criado ainda.";
  }

  return bundles
    .slice(0, 8)
    .map((b) => {
      const v = b.validation;
      const score = v ? ` · score ${v.nota_final}/100` : "";
      const fin =
        b.product.receita_prevista != null
          ? ` · receita prev. ${formatBRL(b.product.receita_prevista)}`
          : "";
      const progress = computeChecklistProgress(b.checklist);
      return `• ${b.product.nome ?? "Sem nome"} (${getPipelineStageLabel(b.product.status)})${score}${fin} · checklist ${progress.percent}%`;
    })
    .join("\n");
}

export function rankLegacyNiches(
  data: LegacyData
): { categoria: LegacyCategoria; count: number; weighted: number }[] {
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
    .map(([categoria, count]) => {
      const priority = LEGACY_PRIORITY_NICHES.find((p) => p.categoria === categoria);
      const weighted = count * (priority?.weight ?? 1);
      return { categoria, count, weighted };
    })
    .sort((a, b) => b.weighted - a.weighted);
}

export function scoreNicheAlignment(nicho: string | null | undefined): number {
  if (!nicho) return 50;
  const normalized = normalize(nicho);
  for (const entry of LEGACY_PRIORITY_NICHES) {
    if (entry.keywords.some((k) => normalized.includes(normalize(k)))) {
      return Math.round(70 + entry.weight * 20);
    }
  }
  return 50;
}

export function buildCreatorCoachReply(params: {
  mode: CreatorCoachMode;
  displayName: string;
  bundles: CreatorProductBundle[];
  legacyData: LegacyData;
  productName?: string;
}): string {
  const { mode, displayName, bundles, legacyData, productName } = params;
  const ranked = rankLegacyNiches(legacyData);
  const topNiche = ranked[0];
  const topLabel = topNiche
    ? LEGACY_CATEGORY_LABELS[topNiche.categoria]
    : "empreendedorismo";

  const forLaunch = rankProductsForLaunch(bundles.filter((b) => b.validation));
  const forSales = rankProductsBySalePotential(bundles);
  const bestLaunch = forLaunch[0];
  const bestSeller = forSales[0];

  if (mode === "creator-niche") {
    const lines = ranked.slice(0, 5).map(
      (r) =>
        `• **${LEGACY_CATEGORY_LABELS[r.categoria]}** — ${r.count} registro(s) · peso ${Math.round(r.weighted)}`
    );
    return `Olá, ${displayName}!

**Seu nicho mais forte (Legado + prioridade):** ${topLabel}

${lines.length > 0 ? lines.join("\n") : "• Importe sua trajetória no módulo Legado para análise completa."}

**Áreas prioritárias:** esporte, dança, teatro, desenvolvimento pessoal, empreendedorismo, bartender, IA e produtividade.

**Sugestão:** transforme essa expertise em produto digital no **Aura Creator** (/dashboard/creator).`;
  }

  if (mode === "creator-best-seller") {
    if (bestSeller) {
      const v = bestSeller.validation;
      return `Olá, ${displayName}!

**Maior chance de vender:** **${bestSeller.product.nome}**

• Lucro potencial: **${v?.lucro_potencial ?? v?.nota_final ?? "—"}/100**
• Compatibilidade com seu perfil: **${v?.compatibilidade_perfil ?? "—"}/100**
• Viabilidade: **${v?.viabilidade ?? "—"}/100**
• Receita prevista: ${formatBRL(bestSeller.product.receita_prevista)}
• ROI estimado: ${bestSeller.product.roi_estimado != null ? `${bestSeller.product.roi_estimado}%` : "—"}

Abra **Aura Creator** para avançar no pipeline de lançamento.`;
    }

    return `Olá, ${displayName}!

Ainda não há produtos com score IA. Com base no Legado, comece por **${topLabel}**.

1. Abra **Aura Creator** → Criar Produto
2. Use **"Use meus dados da Aura"**
3. Valide para gerar scores de viabilidade e lucro`;
  }

  if (mode === "creator-launch") {
    if (bestLaunch) {
      const progress = computeChecklistProgress(bestLaunch.checklist, bestLaunch.product.status);
      return `Olá, ${displayName}!

**Produto recomendado para lançar agora:** **${bestLaunch.product.nome}**
• Estágio: **${getPipelineStageLabel(bestLaunch.product.status)}**
• Nota IA: **${bestLaunch.validation!.nota_final}/100**
• Checklist do estágio: **${progress.percent}%** concluído
• Formato: ${bestLaunch.product.formato ?? "—"}
• Receita prevista: ${formatBRL(bestLaunch.product.receita_prevista)}

Abra **Aura Creator** para avançar no pipeline.`;
    }

    return `Olá, ${displayName}!

Ainda não há produtos prontos para lançamento. Com base no Legado, comece por **${topLabel}**.

1. Abra **Aura Creator** → Criar Produto
2. Use **"Use meus dados da Aura"**
3. Siga o pipeline: Ideia → Pesquisa → Validação → Produção → Lançamento`;
  }

  if (mode === "creator-plan") {
    const target =
      productName != null
        ? bundles.find((b) =>
            normalize(b.product.nome ?? "").includes(normalize(productName))
          )
        : bestLaunch ?? bundles[0];

    if (target) {
      const stage = target.product.status;
      return `Olá, ${displayName}!

**Plano de 30 dias — ${target.product.nome}**

**Semana 1 — Pesquisa & validação**
• Refinar avatar e dores do público
• Analisar 3 concorrentes diretos
• ${stage === "ideia" || stage === "pesquisa" ? "→ Você está aqui" : "Concluir checklist de pesquisa"}

**Semana 2 — Produção**
• Gravar/criar módulo principal do conteúdo
• Definir bônus e garantia
• ${stage === "producao" ? "→ Você está aqui" : "Preparar materiais"}

**Semana 3 — Página & criativos**
• Montar landing page com copy da oferta
• Produzir 3 criativos para anúncios
• ${stage === "pagina_vendas" || stage === "criativos" ? "→ Você está aqui" : "Revisar oferta"}

**Semana 4 — Lançamento & tráfego**
• Publicar landing page
• Ativar campanhas de tráfego
• Monitorar conversões e ajustar
• ${stage === "lancamento" || stage === "trafego" ? "→ Você está aqui" : "Preparar go-live"}

Abra **Aura Creator** para marcar itens do checklist e avançar estágios.`;
    }

    return `Olá, ${displayName}!

Crie um produto primeiro no **Aura Creator** para gerar um plano personalizado de 30 dias.

Sugestão com base no Legado: produto sobre **${topLabel}**.`;
  }

  return `Olá, ${displayName}!

Vou te ajudar a criar um produto digital executável.

**Sugestão com base no Legado:** produto sobre **${topLabel}** — sua área com maior peso estratégico.

**Próximo passo:** abra **Aura Creator** (/dashboard/creator) → **Criar Produto** → **Use meus dados da Aura**.

O pipeline completo: Ideia → Pesquisa → Validação → Produção → Página de vendas → Criativos → Lançamento → Tráfego → Escala.`;
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

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value}%`;
}
