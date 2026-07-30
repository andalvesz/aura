/**
 * Knowledge Hub export — Markdown / JSON / PDF-text payload.
 * executionInfluence: none
 */

import type {
  KnowledgeDocument,
  KnowledgeExportFormat,
  KnowledgeState,
  KnowledgeVersion,
} from "@/lib/knowledge/types";
import { DOCUMENT_TYPE_LABELS } from "@/lib/knowledge/types";

export type KnowledgeExportPayload = {
  format: KnowledgeExportFormat;
  fileName: string;
  mimeType: string;
  content: string;
  executionInfluence: "none";
};

function versionsFor(state: KnowledgeState, documentId: string): KnowledgeVersion[] {
  return state.versions
    .filter((v) => v.documentId === documentId)
    .sort((a, b) => b.version - a.version);
}

export function exportDocumentPure(
  state: KnowledgeState,
  documentId: string,
  format: KnowledgeExportFormat
): KnowledgeExportPayload | null {
  const doc = state.documents.find((d) => d.id === documentId);
  if (!doc) return null;

  const safe = doc.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "document";

  if (format === "json") {
    const payload = {
      document: doc,
      versions: versionsFor(state, documentId),
      relations: state.relations.filter((r) => r.documentId === documentId),
      comments: state.comments.filter(
        (c) => c.documentId === documentId && !c.deletedAt
      ),
      executionInfluence: "none" as const,
    };
    return {
      format,
      fileName: `${safe}.json`,
      mimeType: "application/json",
      content: JSON.stringify(payload, null, 2),
      executionInfluence: "none",
    };
  }

  if (format === "markdown") {
    const md = [
      `# ${doc.title}`,
      "",
      `> Tipo: ${DOCUMENT_TYPE_LABELS[doc.type]} · Visibilidade: ${doc.visibility}`,
      "",
      doc.description ? `${doc.description}\n` : "",
      doc.summary ? `## Resumo\n\n${doc.summary}\n` : "",
      doc.content ? `## Conteúdo\n\n${doc.content}\n` : "",
      doc.ocrText ? `## OCR\n\n${doc.ocrText}\n` : "",
      doc.linkPreview
        ? `## Link\n\n- Título: ${doc.linkPreview.title}\n- URL: ${doc.linkPreview.url}\n- ${doc.linkPreview.description}\n`
        : "",
      doc.tags.length ? `## Tags\n\n${doc.tags.map((t) => `\`${t}\``).join(" ")}\n` : "",
      "",
      `_exportedAt: ${new Date().toISOString()}_`,
      `_executionInfluence: none_`,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      format,
      fileName: `${safe}.md`,
      mimeType: "text/markdown",
      content: md,
      executionInfluence: "none",
    };
  }

  // pdf — textual representation suitable for client-side jsPDF or download as .txt.pdf body
  const pdfBody = [
    doc.title,
    "=".repeat(Math.min(60, doc.title.length)),
    "",
    `Tipo: ${DOCUMENT_TYPE_LABELS[doc.type]}`,
    `Visibilidade: ${doc.visibility}`,
    "",
    doc.description,
    "",
    doc.summary ? `RESUMO\n${doc.summary}\n` : "",
    doc.content ? `CONTEÚDO\n${doc.content}\n` : "",
    doc.ocrText ? `OCR\n${doc.ocrText}\n` : "",
    doc.linkPreview
      ? `LINK\n${doc.linkPreview.title}\n${doc.linkPreview.url}\n${doc.linkPreview.description}\n`
      : "",
    "",
    `executionInfluence: none`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  return {
    format: "pdf",
    fileName: `${safe}.pdf.txt`,
    mimeType: "application/pdf",
    content: pdfBody,
    executionInfluence: "none",
  };
}

export function documentToMarkdownPreview(doc: KnowledgeDocument): string {
  if (doc.type === "note" && doc.content) return doc.content;
  if (doc.summary) return doc.summary;
  if (doc.ocrText) return doc.ocrText.slice(0, 2000);
  if (doc.linkPreview) {
    return [
      `**${doc.linkPreview.title}**`,
      "",
      doc.linkPreview.description,
      "",
      doc.linkPreview.url,
    ].join("\n");
  }
  return doc.description || "_Sem preview_";
}
