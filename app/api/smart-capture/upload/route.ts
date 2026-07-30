/**
 * Upload endpoint — validates type/size, returns metadata (+ optional data URL for small files).
 * Storage bucket wiring prepared; falls back to data URL for small payloads.
 */

import { validateCaptureFile } from "@/lib/smart-capture/validation";
import { prepareVirusScan } from "@/lib/smart-capture/security";
import { runOcr } from "@/lib/smart-capture/ocr";
import { newSmartCaptureId } from "@/lib/smart-capture/types";

export const runtime = "nodejs";

const DATA_URL_MAX = 1.5 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const withOcr = String(form.get("ocr") ?? "1") !== "0";

    if (!(file instanceof File)) {
      return Response.json({ error: "Arquivo obrigatório" }, { status: 400 });
    }

    const validation = validateCaptureFile({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    });
    if (!validation.ok || !validation.kind) {
      return Response.json(
        { error: validation.error ?? "Arquivo inválido" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const id = newSmartCaptureId("up");
    const virusScan = prepareVirusScan();

    let ocrText: string | undefined;
    if (
      withOcr &&
      (validation.kind === "image" ||
        validation.kind === "pdf" ||
        validation.kind === "file")
    ) {
      const ocr = await runOcr({
        kind: validation.kind,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        buffer,
      });
      ocrText = ocr.text || undefined;
    }

    let dataUrl: string | undefined;
    if (file.size <= DATA_URL_MAX) {
      dataUrl = `data:${file.type || "application/octet-stream"};base64,${buffer.toString("base64")}`;
    }

    return Response.json({
      ok: true,
      attachment: {
        id,
        kind: validation.kind,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        url: dataUrl,
        dataUrl,
        storagePath: null,
        ocrText,
      },
      virusScan,
      executionInfluence: "none",
    });
  } catch (error) {
    console.error("[api/smart-capture/upload]", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload falhou" },
      { status: 500 }
    );
  }
}
