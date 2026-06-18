import type { ProductFactory } from "@/types/database";
import {
  parseDesignWithTemplate,
  parseProContent,
  PRODUCT_FACTORY_TEMPLATES,
  type ProductFactoryTemplateId,
} from "@/utils/product-factory-pro";
import {
  parseJsonArray,
  type ProductFactoryChapter,
  type ProductFactoryChecklistItem,
  type ProductFactoryExercise,
} from "@/utils/product-factory";

type Rgb = [number, number, number];

type TemplateTheme = {
  id: ProductFactoryTemplateId;
  primary: Rgb;
  secondary: Rgb;
  accent: Rgb;
  background: Rgb;
  text: Rgb;
  muted: Rgb;
  card: Rgb;
  onPrimary: Rgb;
};

const TEMPLATE_THEMES: Record<ProductFactoryTemplateId, TemplateTheme> = {
  premium_dark: {
    id: "premium_dark",
    primary: [26, 26, 46],
    secondary: [22, 33, 62],
    accent: [233, 69, 96],
    background: [255, 255, 255],
    text: [30, 30, 35],
    muted: [100, 100, 110],
    card: [245, 245, 250],
    onPrimary: [255, 255, 255],
  },
  clean_white: {
    id: "clean_white",
    primary: [37, 99, 235],
    secondary: [241, 245, 249],
    accent: [37, 99, 235],
    background: [255, 255, 255],
    text: [30, 41, 59],
    muted: [100, 116, 139],
    card: [248, 250, 252],
    onPrimary: [255, 255, 255],
  },
  fitness_modern: {
    id: "fitness_modern",
    primary: [15, 118, 110],
    secondary: [236, 253, 245],
    accent: [249, 115, 22],
    background: [255, 255, 255],
    text: [19, 78, 74],
    muted: [94, 120, 115],
    card: [240, 253, 250],
    onPrimary: [255, 255, 255],
  },
  business_pro: {
    id: "business_pro",
    primary: [30, 58, 95],
    secondary: [241, 245, 249],
    accent: [201, 162, 39],
    background: [255, 255, 255],
    text: [15, 23, 42],
    muted: [100, 116, 139],
    card: [248, 250, 252],
    onPrimary: [255, 255, 255],
  },
  relationship_soft: {
    id: "relationship_soft",
    primary: [190, 24, 93],
    secondary: [253, 242, 248],
    accent: [190, 24, 93],
    background: [255, 255, 255],
    text: [131, 24, 67],
    muted: [157, 100, 120],
    card: [253, 242, 248],
    onPrimary: [255, 255, 255],
  },
};

function hexToRgb(hex: string): Rgb | null {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return null;
  const n = Number.parseInt(clean, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function resolveTheme(templateId: ProductFactoryTemplateId, palette: string[]): TemplateTheme {
  const base = TEMPLATE_THEMES[templateId];
  const primary = hexToRgb(palette[0] ?? "") ?? base.primary;
  const accent = hexToRgb(palette[2] ?? palette[1] ?? "") ?? base.accent;
  return { ...base, primary, accent };
}

class ProPdfBuilder {
  private doc: import("jspdf").jsPDF;
  private y = 18;
  private readonly margin = 16;
  private readonly pageW: number;
  private readonly contentW: number;
  private readonly theme: TemplateTheme;
  private pageNum = 1;

  constructor(doc: import("jspdf").jsPDF, theme: TemplateTheme) {
    this.doc = doc;
    this.pageW = doc.internal.pageSize.getWidth();
    this.contentW = this.pageW - this.margin * 2;
    this.theme = theme;
  }

  private setColor(rgb: Rgb) {
    this.doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  }

  private setFill(rgb: Rgb) {
    this.doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  }

  private ensureSpace(needed: number): void {
    const pageH = this.doc.internal.pageSize.getHeight();
    if (this.y + needed > pageH - 22) {
      this.addContentPage();
    }
  }

  private addContentPage(): void {
    this.drawFooter();
    this.doc.addPage();
    this.pageNum += 1;
    this.y = this.margin;
    this.drawPageHeader();
  }

  private drawPageHeader(): void {
    this.setFill(this.theme.secondary);
    this.doc.rect(0, 0, this.pageW, 8, "F");
    this.setFill(this.theme.accent);
    this.doc.rect(0, 8, this.pageW, 1.2, "F");
    this.y = this.margin;
  }

  private drawFooter(): void {
    const pageH = this.doc.internal.pageSize.getHeight();
    this.setColor(this.theme.muted);
    this.doc.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(`Aura Product Factory Pro · Página ${this.pageNum}`, this.margin, pageH - 8);
  }

  private wrapTextFixed(
    text: string,
    x: number,
    startY: number,
    maxWidth: number,
    lineHeight: number,
    fontSize = 11
  ): number {
    this.doc.setFontSize(fontSize);
    let cy = startY;
    const lines = this.doc.splitTextToSize(text, maxWidth) as string[];
    for (const line of lines) {
      this.doc.text(line, x, cy);
      cy += lineHeight;
    }
    return cy;
  }

  private wrapText(
    text: string,
    x: number,
    maxWidth: number,
    lineHeight: number,
    fontSize = 11
  ): number {
    this.doc.setFontSize(fontSize);
    const lines = this.doc.splitTextToSize(text, maxWidth) as string[];
    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.doc.text(line, x, this.y);
      this.y += lineHeight;
    }
    return this.y;
  }

  private sectionTitle(title: string): void {
    this.ensureSpace(18);
    this.setFill(this.theme.primary);
    this.doc.roundedRect(this.margin, this.y - 4, this.contentW, 10, 1.5, 1.5, "F");
    this.setColor(this.theme.onPrimary);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(13);
    this.doc.text(title, this.margin + 4, this.y + 2.5);
    this.y += 14;
    this.setColor(this.theme.text);
  }

  private divider(): void {
    this.ensureSpace(8);
    this.setFill(this.theme.accent);
    this.doc.rect(this.margin, this.y, this.contentW, 0.6, "F");
    this.y += 6;
  }

  private highlightCard(title: string, body: string): void {
    this.ensureSpace(24);
    this.setFill(this.theme.card);
    const lines = this.doc.splitTextToSize(body, this.contentW - 12) as string[];
    const h = 12 + lines.length * 5;
    this.doc.roundedRect(this.margin, this.y, this.contentW, h, 2, 2, "F");
    this.setFill(this.theme.accent);
    this.doc.rect(this.margin, this.y, 3, h, "F");
    this.setColor(this.theme.primary);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11);
    this.doc.text(title, this.margin + 8, this.y + 7);
    this.setColor(this.theme.text);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10);
    let cy = this.y + 13;
    for (const line of lines) {
      this.doc.text(line, this.margin + 8, cy);
      cy += 5;
    }
    this.y += h + 6;
  }

  private checklistItems(items: { label: string; desc?: string }[]): void {
    for (const item of items) {
      this.ensureSpace(10);
      this.setFill(this.theme.secondary);
      this.doc.roundedRect(this.margin, this.y, this.contentW, 8, 1, 1, "F");
      this.setColor(this.theme.accent);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(10);
      this.doc.text("☐", this.margin + 3, this.y + 5.5);
      this.setColor(this.theme.text);
      const label = item.desc ? `${item.label} — ${item.desc}` : item.label;
      this.doc.text(label.slice(0, 90), this.margin + 10, this.y + 5.5);
      this.y += 10;
    }
    this.y += 4;
  }

  coverPage(factory: ProductFactory, premium = false): void {
    const pageH = this.doc.internal.pageSize.getHeight();
    this.setFill(this.theme.primary);
    this.doc.rect(0, 0, this.pageW, pageH, "F");

    if (premium) {
      this.setFill(this.theme.accent);
      this.doc.rect(0, 0, this.pageW, 6, "F");
      this.setColor(this.theme.onPrimary);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(10);
      this.doc.text("EDIÇÃO PREMIUM", this.margin, 14);
    } else {
      this.setFill(this.theme.accent);
      this.doc.rect(0, pageH * 0.62, this.pageW, 3, "F");
    }

    this.setColor(this.theme.onPrimary);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);
    this.doc.text(
      premium ? "AURA PRODUCT FACTORY PRO · PREMIUM" : "AURA PRODUCT FACTORY",
      this.margin,
      premium ? 24 : 24
    );

    this.doc.setFontSize(premium ? 28 : 24);
    const titleLines = this.doc.splitTextToSize(factory.titulo ?? "E-book Premium", this.contentW) as string[];
    let ty = premium ? 48 : 52;
    for (const line of titleLines) {
      this.doc.text(line, this.margin, ty);
      ty += premium ? 13 : 12;
    }

    if (factory.subtitulo) {
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(12);
      ty = this.wrapTextFixed(factory.subtitulo, this.margin, ty + 4, this.contentW, 6, 12);
    }

    this.doc.setFont("helvetica", "italic");
    this.doc.setFontSize(11);
    ty = this.wrapTextFixed(factory.promessa ?? "", this.margin, ty + 4, this.contentW, 6, 11);

    const design = parseDesignWithTemplate(factory.design);
    if (design.capa) {
      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(9);
      this.wrapTextFixed(design.capa, this.margin, ty + 4, this.contentW, 5, 9);
    }

    if (premium) {
      this.setFill(this.theme.accent);
      this.doc.roundedRect(this.margin, pageH - 28, 52, 10, 2, 2, "F");
      this.setColor(this.theme.onPrimary);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.text("PREMIUM", this.margin + 6, pageH - 21);
    }

    this.doc.setFontSize(8);
    this.doc.text(
      PRODUCT_FACTORY_TEMPLATES.find((t) => t.id === design.template_id)?.label ?? "Premium",
      this.margin,
      pageH - 16
    );
    this.drawFooter();
  }

  promisePage(promessaTransformacao: string, publico?: string | null): void {
    this.doc.addPage();
    this.pageNum += 1;
    this.drawPageHeader();
    this.sectionTitle("Sua transformação começa aqui");
    this.doc.setFont("helvetica", "normal");
    this.wrapText(promessaTransformacao, this.margin, this.contentW, 5.8, 12);
    if (publico) {
      this.divider();
      this.highlightCard("Para quem é este produto", publico);
    }
  }

  tableOfContents(items: string[]): void {
    this.addContentPage();
    this.sectionTitle("Sumário");
    this.doc.setFont("helvetica", "normal");
    items.forEach((item, i) => {
      this.ensureSpace(8);
      this.setColor(this.theme.primary);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(11);
      this.doc.text(`${i + 1}.`, this.margin, this.y);
      this.setColor(this.theme.text);
      this.doc.setFont("helvetica", "normal");
      this.wrapText(item, this.margin + 8, this.contentW - 8, 5.5, 11);
      this.y += 1;
    });
  }

  introduction(intro: string, metodologia: string, problema?: string | null, solucao?: string | null): void {
    this.addContentPage();
    this.sectionTitle("Introdução");
    if (problema) {
      this.highlightCard("O problema", problema);
    }
    if (solucao) {
      this.highlightCard("A solução", solucao);
    }
    this.doc.setFont("helvetica", "normal");
    if (intro) this.wrapText(intro, this.margin, this.contentW, 5.8, 11);
    if (metodologia) {
      this.divider();
      this.sectionTitle("Metodologia");
      this.wrapText(metodologia, this.margin, this.contentW, 5.8, 11);
    }
  }

  chapter(ch: ProductFactoryChapter, index: number, premium = false): void {
    this.addContentPage();
    this.sectionTitle(`Capítulo ${index + 1}: ${ch.titulo}`);
    if (ch.resumo) {
      this.highlightCard("Visão geral", ch.resumo);
    }

    if (!premium) {
      this.setColor(this.theme.text);
      this.doc.setFont("helvetica", "normal");
      const body = ch.conteudo || ch.explicacao || "";
      if (body.trim()) this.wrapText(body, this.margin, this.contentW, 5.8, 11);
      return;
    }

    const blocks: { title: string; text: string }[] = [
      { title: "Explicação", text: ch.explicacao ?? ch.conteudo },
      { title: "Exemplo prático", text: ch.exemplo ?? "" },
      { title: "Aplicação prática", text: ch.aplicacao_pratica ?? "" },
    ].filter((b) => b.text.trim());

    for (const block of blocks) {
      this.divider();
      this.setColor(this.theme.primary);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(12);
      this.ensureSpace(8);
      this.doc.text(block.title, this.margin, this.y);
      this.y += 7;
      this.setColor(this.theme.text);
      this.doc.setFont("helvetica", "normal");
      this.wrapText(block.text, this.margin, this.contentW, 5.8, 11);
    }

    if (ch.conteudo && !ch.explicacao) {
      this.wrapText(ch.conteudo, this.margin, this.contentW, 5.8, 11);
    }

    if (ch.exercicio?.trim()) {
      this.highlightCard("Exercício do capítulo", ch.exercicio);
    }
    if (ch.checklist?.trim()) {
      this.highlightCard("Checklist do capítulo", ch.checklist);
    }
  }

  chapterSimple(ch: ProductFactoryChapter, index: number): void {
    this.chapter(ch, index, false);
  }

  exercisesSection(exercises: ProductFactoryExercise[]): void {
    if (exercises.length === 0) return;
    this.addContentPage();
    this.sectionTitle("Exercícios práticos");
    for (const ex of exercises) {
      this.highlightCard(ex.titulo, `${ex.instrucao}${ex.reflexao ? `\n\nReflexão: ${ex.reflexao}` : ""}`);
    }
  }

  checklistSection(items: ProductFactoryChecklistItem[]): void {
    if (items.length === 0) return;
    this.addContentPage();
    this.sectionTitle("Checklist de implementação");
    this.checklistItems(items.map((i) => ({ label: i.item, desc: i.descricao })));
  }

  actionPlan(steps: { item: string; prazo: string; acao: string }[]): void {
    if (steps.length === 0) return;
    this.addContentPage();
    this.sectionTitle("Plano de ação");
    for (const step of steps) {
      this.highlightCard(`${step.item} (${step.prazo})`, step.acao);
    }
  }

  bonusSection(bonus: string, premium = false): void {
    if (!bonus.trim()) return;
    this.addContentPage();
    this.sectionTitle(premium ? "Bônus exclusivo" : "Bônus");
    if (premium) {
      this.setFill(this.theme.secondary);
      this.doc.roundedRect(this.margin, this.y, this.contentW, 40, 2, 2, "F");
      this.setColor(this.theme.text);
      this.doc.setFont("helvetica", "normal");
      this.wrapText(bonus, this.margin + 6, this.contentW - 12, 5.8, 11);
      this.y += 10;
    } else {
      this.wrapText(bonus.slice(0, 600), this.margin, this.contentW, 5.8, 10);
    }
  }

  faqSection(faqs: { pergunta: string; resposta: string }[]): void {
    if (faqs.length === 0) return;
    this.addContentPage();
    this.sectionTitle("Perguntas frequentes (FAQ)");
    for (const faq of faqs) {
      this.highlightCard(`P: ${faq.pergunta}`, faq.resposta);
    }
  }

  premiumCta(text: string): void {
    if (!text.trim()) return;
    this.addContentPage();
    this.setFill(this.theme.primary);
    this.doc.roundedRect(this.margin, this.y, this.contentW, 36, 3, 3, "F");
    this.setColor(this.theme.onPrimary);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(14);
    this.doc.text("Próximos passos", this.margin + 6, this.y + 10);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(11);
    this.wrapText(text, this.margin + 6, this.contentW - 12, 5.5, 11);
    this.y += 20;
  }

  conclusion(text: string): void {
    if (!text.trim()) return;
    this.addContentPage();
    this.sectionTitle("Conclusão");
    this.wrapText(text, this.margin, this.contentW, 5.8, 11);
  }

  disclaimer(text: string): void {
    if (!text.trim()) return;
    this.addContentPage();
    this.sectionTitle("Aviso responsável");
    this.setFill([255, 251, 235]);
    this.doc.roundedRect(this.margin, this.y, this.contentW, 36, 2, 2, "F");
    this.setColor([120, 80, 20]);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9);
    this.wrapText(text, this.margin + 4, this.contentW - 8, 5, 9);
  }

  nextSteps(text: string): void {
    if (!text.trim()) return;
    this.highlightCard("Próximos passos", text);
  }

  finalize(): void {
    this.drawFooter();
    const total = this.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i);
      const pageH = this.doc.internal.pageSize.getHeight();
      this.setColor(this.theme.muted);
      this.doc.setFontSize(8);
      this.doc.setFont("helvetica", "normal");
      this.doc.text(`${i} / ${total}`, this.pageW - this.margin - 8, pageH - 8);
    }
  }
}

export async function generateProductFactoryPdf(
  factory: ProductFactory,
  options?: { premium?: boolean }
): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const design = parseDesignWithTemplate(factory.design);
  const pro = parseProContent(factory.conteudo);
  const theme = resolveTheme(design.template_id, design.paleta);
  const chapters = parseJsonArray<ProductFactoryChapter>(factory.capitulos);
  const exercises = parseJsonArray<ProductFactoryExercise>(factory.exercicios);
  const checklist = parseJsonArray<ProductFactoryChecklistItem>(factory.checklist);
  const faqs = pro.faqs ?? [];
  const premium = options?.premium === true;

  const builder = new ProPdfBuilder(doc, theme);
  builder.coverPage(factory, premium);

  const promessaTransformacao =
    pro.promessa_transformacao ?? factory.promessa ?? "Transforme sua rotina com método prático e aplicável.";
  builder.promisePage(promessaTransformacao, premium ? factory.publico : undefined);

  const baseSumario = [
    "Introdução",
    ...chapters.map((c) => c.titulo),
    ...(premium ? ["Exercícios práticos", "Checklist", "Plano de ação", "Bônus", "FAQ", "Conclusão"] : ["Conclusão"]),
  ];
  const sumario = pro.sumario && pro.sumario.length > 0 ? pro.sumario : baseSumario;
  builder.tableOfContents(sumario);

  builder.introduction(
    pro.introducao ?? "",
    premium ? (pro.metodologia ?? "") : "",
    premium ? factory.problema : undefined,
    premium ? factory.solucao : undefined
  );

  if (premium) {
    chapters.forEach((ch, i) => builder.chapter(ch, i, true));
    builder.exercisesSection(exercises);
    builder.checklistSection(checklist);
    builder.actionPlan(pro.plano_acao ?? []);
    builder.bonusSection(factory.bonus ?? "", true);
    builder.faqSection(faqs);
    builder.conclusion(factory.conclusao ?? "");
    const disclaimer = pro.aviso_responsavel ?? (pro.sensitive_niche ? "" : "");
    if (disclaimer.trim()) builder.disclaimer(disclaimer);
    if (pro.proximos_passos) builder.premiumCta(pro.proximos_passos);
  } else {
    chapters.forEach((ch, i) => builder.chapterSimple(ch, i));
    builder.conclusion(factory.conclusao ?? "");
    const disclaimer = pro.aviso_responsavel ?? "";
    if (disclaimer.trim()) builder.disclaimer(disclaimer);
  }

  builder.finalize();

  const buf = doc.output("arraybuffer");
  return new Uint8Array(buf);
}

export function pdfBytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function countPdfPages(bytes: Uint8Array): number {
  const text = new TextDecoder().decode(bytes.slice(0, Math.min(bytes.length, 50000)));
  const matches = text.match(/\/Type\s*\/Page\b/g);
  return matches?.length ?? 0;
}
