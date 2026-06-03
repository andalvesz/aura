import type { Cliente, Orcamento } from "@/types/database";
import { formatBRL, formatDate } from "@/utils/format";
import { suggestPacoteAlvesz } from "@/utils/alvesz-proposta";

export const ALVESZ_INSTITUCIONAL =
  "Alvesz Experience é especializada em experiências premium de coquetelaria para eventos sociais e corporativos.";

export const ALVESZ_INCLUSO = [
  "Bartenders",
  "Estrutura",
  "Copos",
  "Ingredientes",
  "Atendimento",
] as const;

export const ALVESZ_PAGAMENTO =
  "Reserva mediante sinal de 30% para garantir data e equipe. Saldo até 5 dias úteis antes do evento.";

export const ALVESZ_VALIDADE = "Validade desta proposta: 7 dias corridos.";

export const ALVESZ_CONTATO =
  "Instagram @and.alvesz · Alvesz Experience — Bartender & Eventos · WhatsApp sob consulta.";

export type AlveszPropostaPdfFields = {
  cliente: string;
  evento: string;
  data: string;
  local: string;
  convidados: string;
  pacote: string;
  valor: string;
  textoApresentacao?: string;
};

export function buildAlveszPropostaPdfFields({
  orcamento,
  cliente,
  textoApresentacao,
}: {
  orcamento: Orcamento;
  cliente: Cliente | null;
  textoApresentacao?: string;
}): AlveszPropostaPdfFields {
  const convidados = Number(orcamento.convidados);
  return {
    cliente: cliente?.nome ?? "Cliente",
    evento: orcamento.tipo_evento,
    data: orcamento.data_evento ? formatDate(orcamento.data_evento) : "A definir",
    local: orcamento.local?.trim() || "A definir",
    convidados: String(convidados),
    pacote: suggestPacoteAlvesz(convidados, orcamento.tipo_evento),
    valor: formatBRL(Number(orcamento.valor_total)),
    textoApresentacao: textoApresentacao?.trim() || ALVESZ_INSTITUCIONAL,
  };
}

async function loadLogoDataUrl(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/alvesz/logo.svg");
    const svgText = await res.text();
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("logo load failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 144;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return null;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

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

export async function generateAlveszPropostaPdf(
  fields: AlveszPropostaPdfFields
): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = 16;

  const logo = await loadLogoDataUrl();
  if (logo) {
    doc.addImage(logo, "PNG", margin, y, 70, 16);
    y += 22;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(124, 58, 237);
    doc.text("ALVESZ EXPERIENCE", margin, y + 6);
    y += 14;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(24, 24, 27);
  doc.text("Proposta Comercial", margin, y);
  y += 12;

  doc.setDrawColor(228, 228, 231);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  const dados: [string, string][] = [
    ["Cliente", fields.cliente],
    ["Evento", fields.evento],
    ["Data", fields.data],
    ["Local", fields.local],
    ["Convidados", fields.convidados],
    ["Pacote", fields.pacote],
    ["Valor", fields.valor],
  ];

  doc.setFontSize(10);
  for (const [label, value] of dados) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(82, 82, 91);
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(24, 24, 27);
    const labelW = doc.getTextWidth(`${label}: `);
    y = wrapText(doc, value, margin + labelW, y, contentW - labelW, 5) + 2;
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(124, 58, 237);
  doc.text("Apresentação", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(39, 39, 42);
  y = wrapText(doc, fields.textoApresentacao ?? ALVESZ_INSTITUCIONAL, margin, y, contentW, 5) + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(124, 58, 237);
  doc.text("O que está incluso", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(39, 39, 42);
  for (const item of ALVESZ_INCLUSO) {
    doc.text(`• ${item}`, margin + 2, y);
    y += 5;
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(124, 58, 237);
  doc.text("Condições", margin, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(63, 63, 70);
  doc.text("Pagamento", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(39, 39, 42);
  y = wrapText(doc, ALVESZ_PAGAMENTO, margin, y, contentW, 5) + 4;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(63, 63, 70);
  doc.text("Validade da proposta", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(ALVESZ_VALIDADE, margin, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.text("Contato", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  y = wrapText(doc, ALVESZ_CONTATO, margin, y, contentW, 5);

  const footerY = doc.internal.pageSize.getHeight() - 12;
  doc.setFontSize(8);
  doc.setTextColor(161, 161, 170);
  doc.text("Alvesz Experience — Bartender & Eventos Premium", margin, footerY);

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
