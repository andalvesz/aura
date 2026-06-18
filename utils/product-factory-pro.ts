import type { ProductComplianceCheck, ProductFactory } from "@/types/database";
import type {
  ProductFactoryChapter,
  ProductFactoryChecklistItem,
  ProductFactoryDesign,
  ProductFactoryExercise,
  GeneratedProductFactory,
} from "@/utils/product-factory";
import { parseDesign, parseJsonArray } from "@/utils/product-factory";

export type ProductFactoryTemplateId =
  | "premium_dark"
  | "clean_white"
  | "fitness_modern"
  | "business_pro"
  | "relationship_soft";

export type ProductFactoryProContent = {
  introducao?: string;
  metodologia?: string;
  proximos_passos?: string;
  promessa_transformacao?: string;
  sumario?: string[];
  plano_acao?: { item: string; prazo: string; acao: string }[];
  aviso_responsavel?: string;
  quality_score?: number;
  quality_breakdown?: ProductQualityBreakdown;
  quality_issues?: string[];
  ready_to_sell?: boolean;
  sensitive_niche?: boolean;
  estimated_pages?: number;
  pro_version?: boolean;
};

export type ProductQualityBreakdown = {
  pages: number;
  depth: number;
  visual: number;
  promise: number;
  exercises: number;
  bonus: number;
  compliance: number;
};

export type ProductQualityResult = {
  score: number;
  breakdown: ProductQualityBreakdown;
  readyToSell: boolean;
  issues: string[];
  estimatedPages: number;
};

export const PRODUCT_FACTORY_TEMPLATES: {
  id: ProductFactoryTemplateId;
  label: string;
  defaultPalette: string[];
}[] = [
  { id: "premium_dark", label: "Premium Dark", defaultPalette: ["#1A1A2E", "#16213E", "#E94560", "#F5F5F5"] },
  { id: "clean_white", label: "Clean White", defaultPalette: ["#FFFFFF", "#F8FAFC", "#2563EB", "#1E293B"] },
  { id: "fitness_modern", label: "Fitness Modern", defaultPalette: ["#0F766E", "#134E4A", "#F97316", "#ECFDF5"] },
  { id: "business_pro", label: "Business Pro", defaultPalette: ["#1E3A5F", "#0F172A", "#C9A227", "#F1F5F9"] },
  { id: "relationship_soft", label: "Relationship Soft", defaultPalette: ["#FCE7F3", "#FDF2F8", "#BE185D", "#831843"] },
];

export const PRODUCT_QUALITY_MIN_SCORE = 75;
export const PRODUCT_QUALITY_MIN_PAGES = 15;
export const PRODUCT_QUALITY_IDEAL_PAGES_MIN = 20;
export const PRODUCT_QUALITY_IDEAL_PAGES_MAX = 35;

export const PRODUCT_NOT_READY_MESSAGE = "Produto precisa de melhoria antes de vender.";

const SENSITIVE_NICHE_KEYWORDS = [
  "emagrec",
  "peso",
  "dieta",
  "saude",
  "saúde",
  "fitness",
  "nutri",
  "financ",
  "invest",
  "renda",
  "relacion",
  "casament",
  "namor",
  "ansied",
  "depress",
  "cura",
  "tratament",
] as const;

export const SENSITIVE_NICHE_DISCLAIMER =
  "Aviso importante: este material é educativo e não substitui orientação de profissional qualificado (médico, nutricionista, psicólogo, consultor financeiro ou outro especialista). Consulte um profissional de saúde ou especialista da área antes de tomar decisões. Resultados variam conforme dedicação, contexto e acompanhamento profissional.";

export function parseProContent(value: unknown): ProductFactoryProContent {
  const raw = (value ?? {}) as ProductFactoryProContent;
  return {
    introducao: raw.introducao ?? "",
    metodologia: raw.metodologia ?? "",
    proximos_passos: raw.proximos_passos ?? "",
    promessa_transformacao: raw.promessa_transformacao ?? "",
    sumario: Array.isArray(raw.sumario) ? raw.sumario.map(String) : [],
    plano_acao: Array.isArray(raw.plano_acao)
      ? raw.plano_acao.map((p) => ({
          item: String(p.item ?? ""),
          prazo: String(p.prazo ?? ""),
          acao: String(p.acao ?? ""),
        }))
      : [],
    aviso_responsavel: raw.aviso_responsavel ?? "",
    quality_score: typeof raw.quality_score === "number" ? raw.quality_score : undefined,
    quality_breakdown: raw.quality_breakdown,
    quality_issues: Array.isArray(raw.quality_issues) ? raw.quality_issues.map(String) : [],
    ready_to_sell: raw.ready_to_sell === true,
    sensitive_niche: raw.sensitive_niche === true,
    estimated_pages: typeof raw.estimated_pages === "number" ? raw.estimated_pages : undefined,
    pro_version: raw.pro_version === true,
  };
}

export function parseDesignWithTemplate(value: unknown): ProductFactoryDesign & {
  template_id: ProductFactoryTemplateId;
} {
  const design = parseDesign(value);
  const raw = (value ?? {}) as { template_id?: string };
  const template_id = PRODUCT_FACTORY_TEMPLATES.some((t) => t.id === raw.template_id)
    ? (raw.template_id as ProductFactoryTemplateId)
    : inferTemplateFromNiche(design, "");
  return { ...design, template_id };
}

export function detectSensitiveNiche(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return SENSITIVE_NICHE_KEYWORDS.some((kw) => normalized.includes(kw));
}

export function inferTemplateFromNiche(
  design: ProductFactoryDesign,
  nicheText: string
): ProductFactoryTemplateId {
  const text = `${design.estilo_visual} ${design.moodboard} ${nicheText}`.toLowerCase();
  if (/fitness|treino|emagrec|saúde|saude|nutri/.test(text)) return "fitness_modern";
  if (/negócio|negocio|business|empresa|vendas|marketing/.test(text)) return "business_pro";
  if (/relacion|amor|casal|família|familia/.test(text)) return "relationship_soft";
  if (/premium|luxo|dark|noturno/.test(text)) return "premium_dark";
  return "clean_white";
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function chapterDepthScore(chapters: ProductFactoryChapter[]): number {
  if (chapters.length === 0) return 0;
  let total = 0;
  for (const ch of chapters) {
    let score = 0;
    if (wordCount(ch.conteudo ?? "") >= 180) score += 25;
    if (wordCount(ch.explicacao ?? ch.conteudo ?? "") >= 120) score += 20;
    if (wordCount(ch.exemplo ?? "") >= 40) score += 20;
    if (wordCount(ch.aplicacao_pratica ?? "") >= 40) score += 20;
    if (ch.exercicio || ch.checklist) score += 15;
    total += Math.min(100, score);
  }
  return Math.round(total / chapters.length);
}

export function estimateProductPages(factory: ProductFactory): number {
  const chapters = parseJsonArray<ProductFactoryChapter>(factory.capitulos);
  const exercises = parseJsonArray<ProductFactoryExercise>(factory.exercicios);
  const checklist = parseJsonArray<ProductFactoryChecklistItem>(factory.checklist);
  const pro = parseProContent(factory.conteudo);

  let pages = 2; // capa + promessa
  pages += 1; // sumário
  pages += 1; // introdução
  pages += Math.ceil(wordCount(pro.introducao ?? factory.problema ?? "") / 320);
  pages += Math.ceil(wordCount(pro.metodologia ?? "") / 320);

  for (const ch of chapters) {
    const words =
      wordCount(ch.conteudo) +
      wordCount(ch.explicacao ?? "") +
      wordCount(ch.exemplo ?? "") +
      wordCount(ch.aplicacao_pratica ?? "") +
      wordCount(ch.exercicio ?? "") +
      wordCount(ch.checklist ?? "");
    pages += Math.max(1, Math.ceil(words / 280));
  }

  pages += Math.max(1, Math.ceil(exercises.length / 2));
  pages += Math.max(1, Math.ceil(checklist.length / 6));
  pages += Math.max(1, Math.ceil((pro.plano_acao?.length ?? 0) / 4));
  pages += factory.bonus ? Math.max(1, Math.ceil(wordCount(factory.bonus) / 300)) : 0;
  pages += factory.conclusao ? Math.max(1, Math.ceil(wordCount(factory.conclusao) / 300)) : 0;
  if (pro.aviso_responsavel || pro.sensitive_niche) pages += 1;

  return Math.max(pages, 8);
}

export function computeProductQualityScore(
  factory: ProductFactory,
  compliance?: ProductComplianceCheck | null
): ProductQualityResult {
  const chapters = parseJsonArray<ProductFactoryChapter>(factory.capitulos);
  const exercises = parseJsonArray<ProductFactoryExercise>(factory.exercicios);
  const checklist = parseJsonArray<ProductFactoryChecklistItem>(factory.checklist);
  const design = parseDesignWithTemplate(factory.design);
  const pro = parseProContent(factory.conteudo);
  const estimatedPages = estimateProductPages(factory);
  const issues: string[] = [];

  const pagesScore =
    estimatedPages >= PRODUCT_QUALITY_MIN_PAGES
      ? estimatedPages >= PRODUCT_QUALITY_IDEAL_PAGES_MIN
        ? 100
        : 70 + Math.round(((estimatedPages - PRODUCT_QUALITY_MIN_PAGES) / 5) * 30)
      : Math.round((estimatedPages / PRODUCT_QUALITY_MIN_PAGES) * 60);

  if (estimatedPages < PRODUCT_QUALITY_MIN_PAGES) {
    issues.push(`Estimativa de ${estimatedPages} páginas (mínimo ${PRODUCT_QUALITY_MIN_PAGES}).`);
  }
  if (chapters.length < 5) {
    issues.push(`Apenas ${chapters.length} capítulos (mínimo 5).`);
  }

  const depthScore = chapterDepthScore(chapters);
  if (depthScore < 60) issues.push("Conteúdo dos capítulos ainda superficial.");

  let visualScore = 0;
  if (design.capa) visualScore += 25;
  if (design.paleta.length >= 3) visualScore += 25;
  if (design.estilo_visual) visualScore += 20;
  if (design.paginas_internas) visualScore += 15;
  if (design.template_id) visualScore += 15;
  visualScore = Math.min(100, visualScore);

  const promiseText = `${factory.promessa ?? ""} ${pro.promessa_transformacao ?? ""} ${factory.subtitulo ?? ""}`;
  const promiseScore = Math.min(100, Math.round((wordCount(promiseText) / 40) * 100));

  const exerciseScore = Math.min(
    100,
    exercises.length >= 5 ? 100 : exercises.length >= 3 ? 70 : exercises.length * 20
  );
  if (exercises.length < 5) issues.push(`Apenas ${exercises.length} exercícios (ideal: 5+).`);

  const bonusScore = factory.bonus && wordCount(factory.bonus) >= 30 ? 100 : factory.bonus ? 50 : 0;
  if (!factory.bonus) issues.push("Bônus ausente.");

  let complianceScore = 80;
  if (compliance) {
    if (compliance.status === "fail") complianceScore = 20;
    else if (compliance.status === "warning") complianceScore = 55;
    else complianceScore = 100 - Math.min(40, Number(compliance.risk_score ?? 0) / 2.5);
    const forbidden = parseJsonArray<string>(compliance.forbidden_claims);
    if (forbidden.length > 0) {
      issues.push(`${forbidden.length} claim(s) proibida(s) detectada(s).`);
      complianceScore = Math.min(complianceScore, 40);
    }
  }

  if (!pro.sumario?.length) issues.push("Sumário ausente.");
  if (!pro.plano_acao?.length) issues.push("Plano de ação ausente.");
  if (checklist.length < 5) issues.push(`Checklist com ${checklist.length} itens (mínimo 5).`);

  const breakdown: ProductQualityBreakdown = {
    pages: pagesScore,
    depth: depthScore,
    visual: visualScore,
    promise: promiseScore,
    exercises: exerciseScore,
    bonus: bonusScore,
    compliance: complianceScore,
  };

  const score = Math.round(
    breakdown.pages * 0.2 +
      breakdown.depth * 0.2 +
      breakdown.visual * 0.15 +
      breakdown.promise * 0.1 +
      breakdown.exercises * 0.15 +
      breakdown.bonus * 0.1 +
      breakdown.compliance * 0.1
  );

  const readyToSell = score >= PRODUCT_QUALITY_MIN_SCORE && compliance?.status !== "fail";

  return {
    score,
    breakdown,
    readyToSell,
    issues,
    estimatedPages,
  };
}

export function mergeQualityIntoContent(
  conteudo: Record<string, unknown>,
  quality: ProductQualityResult,
  extras?: Partial<ProductFactoryProContent>
): Record<string, unknown> {
  return {
    ...conteudo,
    ...extras,
    quality_score: quality.score,
    quality_breakdown: quality.breakdown,
    quality_issues: quality.issues,
    ready_to_sell: quality.readyToSell,
    estimated_pages: quality.estimatedPages,
    pro_version: true,
  };
}

export function buildProGenerationSystemPrompt(productType: string, sensitive: boolean): string {
  return `Você é a Aura Product Factory Pro V1 — cria produtos digitais PREMIUM, profundos e vendáveis para o mercado brasileiro.
Tipo de produto: ${productType}

Responda APENAS JSON válido com esta estrutura:
{
  "titulo": string,
  "subtitulo": string,
  "promessa": string,
  "publico": string,
  "objetivo": string,
  "promessa_transformacao": string,
  "sumario": string[],
  "capitulos": [{
    "titulo": string,
    "resumo": string,
    "conteudo": string,
    "explicacao": string,
    "exemplo": string,
    "aplicacao_pratica": string,
    "exercicio": string,
    "checklist": string
  }],
  "conteudo": {
    "introducao": string,
    "metodologia": string,
    "proximos_passos": string,
    "promessa_transformacao": string,
    "sumario": string[],
    "plano_acao": [{ "item": string, "prazo": string, "acao": string }],
    "aviso_responsavel": string
  },
  "exercicios": [{ "titulo": string, "instrucao": string, "reflexao": string }],
  "bonus": string,
  "checklist": [{ "item": string, "descricao": string }],
  "conclusao": string,
  "design": {
    "template_id": "premium_dark" | "clean_white" | "fitness_modern" | "business_pro" | "relationship_soft",
    "capa": string,
    "paleta": string[],
    "estilo_visual": string,
    "paginas_internas": string,
    "mockup_textual": string,
    "tipografia": string,
    "moodboard": string
  },
  "compliance": {
    "risk_score": number,
    "risk_level": "low" | "medium" | "high",
    "forbidden_claims": string[],
    "misleading_risks": string[],
    "ad_checklist": [{ "item": string, "status": "ok" | "atencao" | "bloqueado", "nota": string }],
    "recommendations": string[],
    "status": "pass" | "warning" | "fail",
    "notes": string
  }
}

REGRAS OBRIGATÓRIAS PRO V1:
- E-book completo: capa profissional, promessa/transformação, sumário, introdução, 5 a 8 capítulos, exercícios, checklists, plano de ação, bônus, conclusão
- Conteúdo PROFUNDO: cada capítulo com explicação detalhada (300+ palavras no conteudo), exemplo real, aplicação prática, exercício e mini-checklist
- Mínimo 5 exercícios práticos + checklist final com 5+ itens
- Plano de ação com 5+ passos (item, prazo, ação)
- Bônus tangível e valioso (150+ palavras)
- Design: escolha template_id coerente com o nicho; paleta 4-5 cores hex; capa e layout descritos com detalhe
- Volume equivalente a 20-35 páginas de PDF A4 (conteúdo denso, não superficial)
- Português do Brasil, tom profissional e acionável
${sensitive ? `
NICHO SENSÍVEL DETECTADO — OBRIGATÓRIO:
- NÃO prometer cura, resultado garantido ou transformação instantânea
- Incluir aviso_responsavel: consulte profissional de saúde/especialista
- Focar em hábitos, organização, consistência e educação
- Evitar claims extremos de emagrecimento, renda ou saúde
- compliance.status deve ser "pass" ou "warning", nunca prometer milagres
` : "- Compliance rigoroso: nunca prometa resultados garantidos; evite claims médicos/financeiros proibidos"}`;
}

export type ProChapter = ProductFactoryChapter & {
  explicacao?: string;
  exemplo?: string;
  aplicacao_pratica?: string;
  exercicio?: string;
  checklist?: string;
};

export type ProGeneratedProduct = Omit<GeneratedProductFactory, "conteudo"> & {
  promessa_transformacao?: string;
  sumario?: string[];
  design: ProductFactoryDesign & { template_id?: ProductFactoryTemplateId };
  conteudo?: Partial<ProductFactoryProContent> & Record<string, string>;
};

export function normalizeProGenerated(
  generated: ProGeneratedProduct,
  sensitive: boolean
): {
  capitulos: ProChapter[];
  conteudo: Record<string, unknown>;
  design: ProductFactoryDesign & { template_id: ProductFactoryTemplateId };
} {
  const nicheText = `${generated.titulo} ${generated.promessa} ${generated.publico ?? ""}`;
  const templateId =
    generated.design?.template_id &&
    PRODUCT_FACTORY_TEMPLATES.some((t) => t.id === generated.design.template_id)
      ? generated.design.template_id
      : inferTemplateFromNiche(generated.design ?? parseDesign(null), nicheText);

  const template = PRODUCT_FACTORY_TEMPLATES.find((t) => t.id === templateId)!;
  const paleta =
    generated.design?.paleta?.length >= 3
      ? generated.design.paleta
      : template.defaultPalette;

  const capitulos: ProChapter[] = (generated.capitulos ?? []).map((ch) => ({
    titulo: ch.titulo,
    resumo: ch.resumo,
    conteudo: ch.conteudo,
    explicacao: (ch as ProChapter).explicacao ?? ch.conteudo,
    exemplo: (ch as ProChapter).exemplo ?? "",
    aplicacao_pratica: (ch as ProChapter).aplicacao_pratica ?? "",
    exercicio: (ch as ProChapter).exercicio ?? "",
    checklist: (ch as ProChapter).checklist ?? "",
  }));

  const sumario =
    generated.sumario ??
    generated.conteudo?.sumario ??
    capitulos.map((c) => c.titulo);

  const conteudo: Record<string, unknown> = {
    ...generated.conteudo,
    introducao: generated.conteudo?.introducao ?? "",
    metodologia: generated.conteudo?.metodologia ?? "",
    proximos_passos: generated.conteudo?.proximos_passos ?? generated.proximos_passos ?? "",
    promessa_transformacao:
      generated.promessa_transformacao ??
      generated.conteudo?.promessa_transformacao ??
      generated.promessa,
    sumario,
    plano_acao: generated.conteudo?.plano_acao ?? [],
    aviso_responsavel:
      sensitive || generated.conteudo?.aviso_responsavel
        ? generated.conteudo?.aviso_responsavel || SENSITIVE_NICHE_DISCLAIMER
        : "",
    sensitive_niche: sensitive,
    pro_version: true,
  };

  const design = {
    ...parseDesign(generated.design),
    template_id: templateId,
    paleta,
    capa: generated.design?.capa ?? `Capa premium para ${generated.titulo}`,
  };

  return { capitulos, conteudo, design };
}

export type ProductFactoryProAction =
  | "improve"
  | "regenerate_design"
  | "expand_content"
  | "premium";

export function buildProActionPrompt(
  action: ProductFactoryProAction,
  factory: ProductFactory
): string {
  const chapters = parseJsonArray<ProductFactoryChapter>(factory.capitulos);
  const base = JSON.stringify({
    titulo: factory.titulo,
    promessa: factory.promessa,
    capitulos: chapters.slice(0, 3),
    product_type: factory.product_type,
  });

  switch (action) {
    case "improve":
      return `Melhore este produto digital para padrão PRO vendável. Aprofunde promessa, clareza, exercícios e plano de ação. Retorne JSON completo no schema Pro V1.\n${base}`;
    case "regenerate_design":
      return `Regenere APENAS o design premium (template_id, paleta, capa, estilo, tipografia, moodboard, paginas_internas) coerente com o produto. Retorne JSON completo Pro V1 mantendo conteúdo similar mas design novo.\n${base}`;
    case "expand_content":
      return `Expanda o conteúdo para 5-8 capítulos profundos (300+ palavras cada), mais exercícios e checklist. Retorne JSON completo Pro V1.\n${base}`;
    case "premium":
      return `Gere versão PREMIUM completa: máximo profissionalismo, 20-35 páginas equivalentes, todos os blocos Pro V1.\n${base}`;
  }
}
