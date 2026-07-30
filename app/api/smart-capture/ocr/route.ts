/**
 * OCR endpoint — image / PDF → text (editable client-side before save).
 */

import { runOcr } from "@/lib/smart-capture/ocr";
import { validateCaptureFile } from "@/lib/smart-capture/validation";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
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
    const ocr = await runOcr({
      kind: validation.kind,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
    });

    return Response.json({
      ok: true,
      kind: validation.kind,
      ocr,
      executionInfluence: "none",
    });
  } catch (error) {
    console.error("[api/smart-capture/ocr]", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "OCR falhou" },
      { status: 500 }
    );
  }
}
