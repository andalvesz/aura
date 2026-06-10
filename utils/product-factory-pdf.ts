import type { ProductFactory } from "@/types/database";
import {
  parseDesign,
  parseJsonArray,
  type ProductFactoryChapter,
  type ProductFactoryChecklistItem,
  type ProductFactoryExercise,
} from "@/utils/product-factory";

function wrapText(
  doc: import("jspdf").jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const lines = doc.splitTextToSize(text, maxWidth) as string[];
  lines.forEach((line, i) => {
    doc.text(line, x, y + i * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function ensureSpace(doc: import("jspdf").jsPDF, y: number, needed: number, margin: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - margin) {
    doc.addPage();
    return margin;
  }
  return y;
}

export async function generateProductFactoryPdf(factory: ProductFactory): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentW = pageW - margin * 2;
  const design = parseDesign(factory.design);
  const chapters = parseJsonArray<ProductFactoryChapter>(factory.capitulos);
  const exercises = parseJsonArray<ProductFactoryExercise>(factory.exercicios);
  const checklist = parseJsonArray<ProductFactoryChecklistItem>(factory.checklist);

  let y = margin;

  doc.setFillColor(30, 27, 75);
  doc.rect(0, 0, pageW, 80, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  y = wrapText(doc, factory.titulo ?? "E-book Aura", margin, 28, contentW, 10);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  wrapText(doc, factory.promessa ?? "", margin, y + 6, contentW, 6);
  if (design.capa) {
    doc.setFontSize(9);
    wrapText(doc, design.capa, margin, 62, contentW, 4);
  }

  doc.addPage();
  y = margin;
  doc.setTextColor(30, 30, 35);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Introdução", margin, y);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  if (factory.problema) {
    y = ensureSpace(doc, y, 20, margin);
    y = wrapText(doc, `Problema: ${factory.problema}`, margin, y, contentW, 5.5);
    y += 4;
  }
  if (factory.solucao) {
    y = ensureSpace(doc, y, 20, margin);
    y = wrapText(doc, `Solução: ${factory.solucao}`, margin, y, contentW, 5.5);
    y += 8;
  }

  for (const chapter of chapters) {
    y = ensureSpace(doc, y, 30, margin);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    y = wrapText(doc, chapter.titulo, margin, y, contentW, 7);
    y += 2;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    if (chapter.resumo) {
      y = wrapText(doc, chapter.resumo, margin, y, contentW, 5);
      y += 3;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    y = wrapText(doc, chapter.conteudo, margin, y, contentW, 5.5);
    y += 8;
  }

  if (exercises.length > 0) {
    y = ensureSpace(doc, y, 20, margin);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Exercícios", margin, y);
    y += 8;
    for (const ex of exercises) {
      y = ensureSpace(doc, y, 25, margin);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      y = wrapText(doc, ex.titulo, margin, y, contentW, 5.5);
      doc.setFont("helvetica", "normal");
      y = wrapText(doc, ex.instrucao, margin, y + 1, contentW, 5.5);
      if (ex.reflexao) {
        y = wrapText(doc, `Reflexão: ${ex.reflexao}`, margin, y + 2, contentW, 5.5);
      }
      y += 6;
    }
  }

  if (factory.bonus) {
    y = ensureSpace(doc, y, 20, margin);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Bônus", margin, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    y = wrapText(doc, factory.bonus, margin, y, contentW, 5.5);
    y += 8;
  }

  if (checklist.length > 0) {
    y = ensureSpace(doc, y, 20, margin);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Checklist de implementação", margin, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    checklist.forEach((item, i) => {
      y = ensureSpace(doc, y, 12, margin);
      y = wrapText(doc, `${i + 1}. ${item.item} — ${item.descricao}`, margin, y, contentW, 5.5);
      y += 2;
    });
    y += 4;
  }

  if (factory.conclusao) {
    y = ensureSpace(doc, y, 20, margin);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Conclusão", margin, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    wrapText(doc, factory.conclusao, margin, y, contentW, 5.5);
  }

  const footerY = doc.internal.pageSize.getHeight() - 10;
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(161, 161, 170);
    doc.text(`Aura Product Factory · v${factory.current_version}`, margin, footerY);
    doc.text(`${i}/${pageCount}`, pageW - margin - 10, footerY);
  }

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
