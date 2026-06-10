import type {
  ProductComplianceCheck,
  ProductFactory,
  ProductFile,
  ProductVersion,
} from "@/types/database";
import type { CreatorProductBundle } from "@/utils/creator";

export type ProductFactoryStatus =
  | "draft"
  | "content_ready"
  | "design_ready"
  | "pdf_ready"
  | "published";

export type ProductFactoryIntake = {
  titulo: string;
  promessa: string;
  avatar: string;
  problema: string;
  solucao: string;
  product_id?: string | null;
  copylab_id?: string | null;
  research_id?: string | null;
};

export type ProductFactoryChapter = {
  titulo: string;
  resumo: string;
  conteudo: string;
};

export type ProductFactoryExercise = {
  titulo: string;
  instrucao: string;
  reflexao: string;
};

export type ProductFactoryChecklistItem = {
  item: string;
  descricao: string;
};

export type ProductFactoryDesign = {
  capa: string;
  paleta: string[];
  estilo_visual: string;
  paginas_internas: string;
  mockup_textual: string;
  tipografia: string;
  moodboard: string;
};

export type ProductFactoryComplianceItem = {
  item: string;
  status: "ok" | "atencao" | "bloqueado";
  nota: string;
};

export type GeneratedProductFactory = {
  titulo: string;
  promessa: string;
  capitulos: ProductFactoryChapter[];
  conteudo: Record<string, string>;
  exercicios: ProductFactoryExercise[];
  bonus: string;
  checklist: ProductFactoryChecklistItem[];
  conclusao: string;
  design: ProductFactoryDesign;
  compliance: {
    risk_score: number;
    risk_level: "low" | "medium" | "high";
    forbidden_claims: string[];
    misleading_risks: string[];
    ad_checklist: ProductFactoryComplianceItem[];
    recommendations: string[];
    status: "pass" | "warning" | "fail";
    notes: string;
  };
};

export type ProductFactoryBundle = {
  factory: ProductFactory;
  files: ProductFile[];
  versions: ProductVersion[];
  compliance: ProductComplianceCheck | null;
  latestPdf: ProductFile | null;
};

export type ProductFactoryDashboardMetrics = {
  totalProducts: number;
  withPdf: number;
  compliancePass: number;
  ultimoTitulo: string;
};

export const PRODUCT_FACTORY_AI_CONTEXT = `Você é a Aura Product Factory — especialista em criar produtos digitais completos (e-books) com conteúdo premium, design coerente e conformidade para anúncios no Brasil.
Gere conteúdo prático, estruturado e ético. Evite promessas milagrosas, claims médicos/financeiros proibidos e linguagem enganosa.`;

export const PRODUCT_FACTORY_IA_ACTIONS = [
  {
    id: "criar-ebook",
    label: "Criar e-book",
    prompt: "Crie um e-book completo para meu produto digital.",
  },
  {
    id: "gerar-design",
    label: "Gerar design",
    prompt: "Gere o design visual do meu e-book — capa, paleta e mockup.",
  },
  {
    id: "revisar-compliance",
    label: "Revisar compliance",
    prompt: "Analise a promessa e o conteúdo do meu produto para anúncios.",
  },
] as const;

export const FACTORY_INTEGRATIONS = [
  { href: "/dashboard/creator", label: "Creator" },
  { href: "/dashboard/creator/research", label: "Research" },
  { href: "/dashboard/creator/copy", label: "CopyLab" },
  { href: "/dashboard/creator/landing", label: "Landing Builder" },
  { href: "/dashboard/creator/ads", label: "Ads Manager" },
  { href: "/dashboard/performance", label: "Performance AI" },
  { href: "/dashboard/money", label: "Money Missions" },
] as const;

export function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  return [];
}

export function parseDesign(value: unknown): ProductFactoryDesign {
  const raw = (value ?? {}) as Partial<ProductFactoryDesign>;
  return {
    capa: raw.capa ?? "",
    paleta: Array.isArray(raw.paleta) ? raw.paleta.map(String) : [],
    estilo_visual: raw.estilo_visual ?? "",
    paginas_internas: raw.paginas_internas ?? "",
    mockup_textual: raw.mockup_textual ?? "",
    tipografia: raw.tipografia ?? "",
    moodboard: raw.moodboard ?? "",
  };
}

export function intakeFromProductBundle(bundle: CreatorProductBundle): ProductFactoryIntake {
  return {
    titulo: bundle.product.nome ?? "",
    promessa: bundle.product.promessa ?? bundle.offer?.headline ?? "",
    avatar: bundle.product.avatar ?? bundle.product.publico_alvo ?? "",
    problema: bundle.product.problema ?? "",
    solucao: bundle.product.solucao ?? "",
    product_id: bundle.product.id,
    copylab_id: null,
    research_id: null,
  };
}

export function computeProductFactoryDashboard(
  bundles: ProductFactoryBundle[]
): ProductFactoryDashboardMetrics {
  const withPdf = bundles.filter((b) => b.latestPdf?.file_url).length;
  const compliancePass = bundles.filter((b) => b.compliance?.status === "pass").length;
  const ultimo = bundles[0]?.factory.titulo ?? "—";

  return {
    totalProducts: bundles.length,
    withPdf,
    compliancePass,
    ultimoTitulo: ultimo,
  };
}

export function complianceStatusLabel(status: string | null | undefined): string {
  if (status === "pass") return "Aprovado";
  if (status === "fail") return "Bloqueado";
  return "Atenção";
}

export function complianceStatusColor(status: string | null | undefined): string {
  if (status === "pass") return "text-emerald-300 bg-emerald-500/15";
  if (status === "fail") return "text-rose-300 bg-rose-500/15";
  return "text-amber-300 bg-amber-500/15";
}

export function factoryStatusLabel(status: ProductFactoryStatus | string | null): string {
  const map: Record<string, string> = {
    draft: "Rascunho",
    content_ready: "Conteúdo pronto",
    design_ready: "Design pronto",
    pdf_ready: "PDF pronto",
    published: "Publicado",
  };
  return map[status ?? "draft"] ?? "Rascunho";
}
