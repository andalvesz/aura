/**
 * OCR for Smart Capture — PDF via pdf-parse; images via vision (optional) or utf8 fallback.
 * Always allows manual edit before save (edited flag).
 */

import type { OcrResult } from "@/lib/smart-capture/types";

export type ImageOcrFn = (buffer: Buffer, mimeType: string) => Promise<string>;

function looksLikeUtf8Text(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 2048));
  let weird = 0;
  for (const b of sample) {
    if (b === 0) return false;
    if (b < 9 || (b > 13 && b < 32)) weird += 1;
  }
  return weird / sample.length < 0.05;
}

export async function extractPdfText(buffer: Buffer): Promise<OcrResult> {
  try {
    const pdfParseModule = await import("pdf-parse");
    const pdfParse =
      typeof pdfParseModule === "function"
        ? pdfParseModule
        : (
            pdfParseModule as {
              default?: (buf: Buffer) => Promise<{ text?: string }>;
            }
          ).default;
    if (!pdfParse) {
      return { text: "", confidence: 0, provider: "none", edited: false };
    }
    const result = await pdfParse(buffer);
    const text = result.text?.trim() ?? "";
    return {
      text,
      confidence: text ? 0.9 : 0,
      provider: "pdf-parse",
      edited: false,
    };
  } catch {
    return { text: "", confidence: 0, provider: "none", edited: false };
  }
}

export async function extractImageText(
  buffer: Buffer,
  mimeType: string,
  imageOcr?: ImageOcrFn
): Promise<OcrResult> {
  if (imageOcr) {
    const text = (await imageOcr(buffer, mimeType)).trim();
    return {
      text,
      confidence: text ? 0.75 : 0,
      provider: "vision",
      edited: false,
    };
  }

  // Optional OpenAI vision when key present (best-effort; never blocks capture).
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (apiKey) {
    try {
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey });
      const b64 = buffer.toString("base64");
      const dataUrl = `data:${mimeType};base64,${b64}`;
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 1200,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extraia todo o texto visível desta imagem. Responda apenas com o texto OCR, sem comentários.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      });
      const text = response.choices[0]?.message?.content?.trim() ?? "";
      return {
        text,
        confidence: text ? 0.8 : 0,
        provider: "vision",
        edited: false,
      };
    } catch {
      /* fall through */
    }
  }

  if (looksLikeUtf8Text(buffer)) {
    return {
      text: buffer.toString("utf-8").trim(),
      confidence: 0.5,
      provider: "utf8",
      edited: false,
    };
  }

  return { text: "", confidence: 0, provider: "none", edited: false };
}

export async function runOcr(input: {
  kind: "image" | "pdf" | "file" | "audio" | "link" | "video_link";
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  imageOcr?: ImageOcrFn;
}): Promise<OcrResult> {
  if (input.kind === "pdf" || input.mimeType === "application/pdf") {
    return extractPdfText(input.buffer);
  }
  if (input.kind === "image" || input.mimeType.startsWith("image/")) {
    return extractImageText(input.buffer, input.mimeType, input.imageOcr);
  }
  if (
    input.kind === "file" &&
    (input.mimeType.startsWith("text/") ||
      input.fileName.toLowerCase().endsWith(".md") ||
      input.fileName.toLowerCase().endsWith(".txt"))
  ) {
    return {
      text: input.buffer.toString("utf-8").trim(),
      confidence: 1,
      provider: "utf8",
      edited: false,
    };
  }
  return { text: "", confidence: 0, provider: "none", edited: false };
}

export function applyOcrEdit(result: OcrResult, editedText: string): OcrResult {
  return {
    ...result,
    text: editedText,
    edited: true,
    provider: result.provider === "none" ? "manual" : result.provider,
    confidence: editedText.trim() ? Math.max(result.confidence, 0.5) : 0,
  };
}
