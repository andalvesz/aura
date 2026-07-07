import type {
  ProductComplianceCheck,
  ProductFactory,
  ProductFactoryType,
  ProductFile,
  ProductVersion,
  ProductVersionLabel,
} from "@/types/database";
import type { CreatorProductBundle } from "@/utils/creator";

export type { ProductFactoryType, ProductVersionLabel };

export type ProductFactoryStatus =
  | "draft"
  | "content_ready"
  | "design_ready"
  | "pdf_ready"
  | "published";

export const PRODUCT_FACTORY_TYPES: {
  id: ProductFactoryType;
  label: string;
}[] = [
  { id: "ebook", label: "E-book" },
  { id: "checklist", label: "Checklist" },
  { id: "workbook", label: "Workbook" },
  { id: "guia_pratico", label: "Guia prático" },
  { id: "plano_7_dias", label: "Plano de 7 dias" },
  { id: "plano_30_dias", label: "Plano de 30 dias" },
  { id: "mini_curso", label: "Mini curso estruturado" },
];

export type ProductFactoryIntake = {
  titulo: string;
  subtitulo?: string;
  promessa: string;
  avatar: string;
  publico?: string;
  objetivo?: string;
  problema: string;
  solucao: string;
  product_type?: ProductFactoryType;
  product_id?: string | null;
  copylab_id?: string | null;
  research_id?: string | null;
  build_brief?: import("@/utils/product-build-brief").ProductBuildBrief;
};

export type ProductFactoryChapter = {
  titulo: string;
  resumo: string;
  conteudo: string;
  explicacao?: string;
  exemplo?: string;
  aplicacao_pratica?: string;
  exercicio?: string;
  checklist?: string;
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
  template_id?: string;
};

export type ProductFactoryComplianceItem = {
  item: string;
  status: "ok" | "atencao" | "bloqueado";
  nota: string;
};

export type GeneratedProductFactory = {
  titulo: string;
  subtitulo?: string;
  promessa: string;
  publico?: string;
  objetivo?: string;
  capitulos: ProductFactoryChapter[];
  conteudo: Record<string, string>;
  exercicios: ProductFactoryExercise[];
  bonus: string;
  checklist: ProductFactoryChecklistItem[];
  conclusao: string;
  proximos_passos?: string;
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

export const PRODUCT_FACTORY_AI_CONTEXT = `Você é a Aura Product Factory — especialista em criar produtos digitais completos (e-books, checklists, workbooks, guias e planos) com conteúdo premium, design coerente e conformidade para anúncios no Brasil.
Gere conteúdo prático, estruturado e ético. Nunca prometa resultados garantidos. Evite claims médicos/financeiros proibidos e linguagem enganosa.`;

export const PRODUCT_FACTORY_IA_ACTIONS = [
  {
    id: "criar-ebook",
    label: "Criar e-book",
    prompt: "Crie um e-book completo para meu produto digital.",
  },
  {
    id: "gerar-pdf",
    label: "Gerar PDF",
    prompt: "Transforme esse produto em PDF pronto para download.",
  },
  {
    id: "revisar-produto",
    label: "Revisar produto",
    prompt: "Revise esse produto e sugira melhorias no conteúdo.",
  },
  {
    id: "revisar-compliance",
    label: "Compliance",
    prompt: "Esse produto pode ser anunciado? Analise promessa e claims.",
  },
] as const;

export const FACTORY_INTEGRATIONS = [
  { href: "/dashboard/creator", label: "Creator" },
  { href: "/dashboard/creator/research", label: "Market Research" },
  { href: "/dashboard/creator/copy", label: "CopyLab" },
  { href: "/dashboard/creator/launch", label: "Launch Center" },
  { href: "/dashboard/creator/studio", label: "Creative Studio" },
  { href: "/dashboard/creator/landing", label: "Landing Builder" },
  { href: "/dashboard/money", label: "Money Missions" },
  { href: "/dashboard/legado", label: "Legado" },
] as const;

export const PRODUCT_FILES_BUCKET = "product-files";
export const STORAGE_BUCKET_WARNING =
  "Configure o bucket product-files no Supabase Storage.";

export function buildProductFactoryDownloadUrl(fileId: string): string {
  return `/api/creator/factory/pdf/${fileId}`;
}

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
    template_id: raw.template_id,
  };
}

export function intakeFromProductBundle(bundle: CreatorProductBundle): ProductFactoryIntake {
  return {
    titulo: bundle.product.nome ?? "",
    subtitulo: bundle.offer?.subheadline ?? "",
    promessa: bundle.product.promessa ?? bundle.offer?.headline ?? "",
    avatar: bundle.product.avatar ?? bundle.product.publico_alvo ?? "",
    publico: bundle.product.publico_alvo ?? bundle.product.avatar ?? "",
    objetivo: bundle.product.solucao ?? "",
    problema: bundle.product.problema ?? "",
    solucao: bundle.product.solucao ?? "",
    product_type: "ebook",
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

export function productTypeLabel(type: ProductFactoryType | string | null | undefined): string {
  return PRODUCT_FACTORY_TYPES.find((t) => t.id === type)?.label ?? "E-book";
}

export function versionLabelText(label: ProductVersionLabel | string | null | undefined): string {
  const map: Record<string, string> = {
    rascunho: "v1 — Rascunho",
    revisado: "v2 — Revisado",
    final: "v3 — Final",
  };
  return map[label ?? ""] ?? "Versão";
}

export function resolveVersionLabel(versionNumber: number): ProductVersionLabel {
  if (versionNumber <= 1) return "rascunho";
  if (versionNumber === 2) return "revisado";
  return "final";
}

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

const FACTORY_CREATE_PHRASES = [
  "crie um ebook",
  "crie um e-book",
  "criar um ebook",
  "criar um e-book",
  "crie ebook",
  "criar ebook",
  "gerar ebook",
  "gerar e-book",
  "crie um produto digital",
] as const;

const FACTORY_PDF_PHRASES = [
  "transforme esse produto em pdf",
  "transforme em pdf",
  "gerar pdf",
  "gerar o pdf",
  "criar pdf do produto",
  "exportar pdf",
] as const;

const FACTORY_REVIEW_PHRASES = [
  "revise esse produto",
  "revisar esse produto",
  "revisar produto",
  "revise o produto",
  "melhore esse produto",
] as const;

const FACTORY_COMPLIANCE_PHRASES = [
  "esse produto pode ser anunciado",
  "pode ser anunciado",
  "analise compliance",
  "revisar compliance",
  "compliance do produto",
  "posso anunciar esse produto",
] as const;

export type ProductFactoryCoachMode =
  | "factory-create"
  | "factory-pdf"
  | "factory-review"
  | "factory-compliance";

export function detectFactoryCoachMode(message: string): ProductFactoryCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, FACTORY_COMPLIANCE_PHRASES)) return "factory-compliance";
  if (matchesAny(normalized, FACTORY_PDF_PHRASES)) return "factory-pdf";
  if (matchesAny(normalized, FACTORY_REVIEW_PHRASES)) return "factory-review";
  if (matchesAny(normalized, FACTORY_CREATE_PHRASES)) return "factory-create";
  return null;
}

export function buildFactoryCoachReply(params: {
  mode: ProductFactoryCoachMode;
  displayName: string;
  bundles: ProductFactoryBundle[];
  message?: string;
}): string {
  const { mode, displayName, bundles, message } = params;
  const latest = bundles[0];

  if (mode === "factory-create") {
    if (latest) {
      return `Olá, ${displayName}!

**Último produto:** ${latest.factory.titulo ?? "—"} (${productTypeLabel(latest.factory.product_type)})

Abra **Aura Product Factory** (/dashboard/creator/factory) para gerar um novo produto digital com capítulos, exercícios, design e compliance.

${message ? `\nVocê pediu: _"${message.slice(0, 120)}"_` : ""}`;
    }

    return `Olá, ${displayName}!

Para criar um produto digital completo:

1. Abra **Aura Product Factory** (/dashboard/creator/factory)
2. Escolha o tipo (e-book, checklist, workbook, guia, plano ou mini curso)
3. Informe título, promessa, público e objetivo
4. A Aura gera conteúdo, design e checklist de compliance

Você pode vincular dados do Creator, Research e CopyLab.`;
  }

  if (mode === "factory-pdf") {
    if (latest?.latestPdf?.file_url) {
      return `Olá, ${displayName}!

**${latest.factory.titulo ?? "Produto"}** já tem PDF publicado.

Baixe em **Product Factory** (/dashboard/creator/factory) ou gere uma nova versão com **Gerar PDF**.`;
    }

    if (latest) {
      return `Olá, ${displayName}!

**${latest.factory.titulo ?? "Produto"}** está pronto para exportar.

1. Abra **Product Factory** (/dashboard/creator/factory)
2. Selecione o produto
3. Clique em **Gerar PDF**

O arquivo será salvo no Supabase Storage (bucket \`product-files\`).`;
    }

    return `Olá, ${displayName}!

Primeiro crie um produto em **Aura Product Factory** (/dashboard/creator/factory), depois use **Gerar PDF** para baixar.`;
  }

  if (mode === "factory-review") {
    if (latest) {
      return `Olá, ${displayName}!

**Produto:** ${latest.factory.titulo ?? "—"}
**Status:** ${factoryStatusLabel(latest.factory.status)}
**Versão:** ${versionLabelText(latest.versions[0]?.version_label ?? resolveVersionLabel(latest.factory.current_version))}

**Sugestões:**
• Revise promessa e subtítulo para clareza
• Confira exercícios e checklist final
• Rode **Revisar compliance** antes de anunciar

Abra **Product Factory** (/dashboard/creator/factory) e use a IA do módulo.`;
    }

    return `Olá, ${displayName}!

Crie um produto em **Product Factory** (/dashboard/creator/factory) para revisar conteúdo e estrutura.`;
  }

  if (latest) {
    const status = latest.compliance?.status ?? "warning";
    return `Olá, ${displayName}!

**Produto:** ${latest.factory.titulo ?? "—"}
**Compliance:** ${complianceStatusLabel(status)}
**Promessa:** ${latest.factory.promessa ?? "—"}

${status === "pass" ? "✅ Linguagem responsável — pode anunciar com os ajustes habituais de plataforma." : "⚠️ Revise claims e promessas antes de veicular anúncios."}

Abra **Product Factory** (/dashboard/creator/factory) → aba **Compliance** para o checklist completo.`;
  }

  return `Olá, ${displayName}!

Gere um produto em **Aura Product Factory** (/dashboard/creator/factory) — a análise de compliance roda automaticamente na criação.`;
}

export function buildFactoryAuraContext(bundles: ProductFactoryBundle[]): string {
  if (bundles.length === 0) return "Nenhum produto na Product Factory.";

  return bundles
    .slice(0, 6)
    .map(
      (b) =>
        `• ${b.factory.titulo ?? "Produto"} (${productTypeLabel(b.factory.product_type)}) — ${factoryStatusLabel(b.factory.status)} · PDF: ${b.latestPdf ? "sim" : "não"}`
    )
    .join("\n");
}
