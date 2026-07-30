/**
 * Share Mode endpoint — prepared for Android Share / iOS Share / Web Share API.
 * Accepts text, url, title, files (multipart). Does not publish native apps.
 */

import { smartCapture } from "@/lib/supabase/services/smart-capture.service";
import {
  detectVideoLink,
  isHttpUrl,
  type CaptureAttachmentInput,
} from "@/lib/smart-capture/types";
import { runOcr } from "@/lib/smart-capture/ocr";
import { validateCaptureFile } from "@/lib/smart-capture/validation";

export const runtime = "nodejs";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export async function GET() {
  return json({
    ok: true,
    mode: "share-target-ready",
    platforms: ["android-share", "ios-share", "web-share-api"],
    accept: ["text", "url", "title", "image", "pdf", "audio"],
    endpoint: "/api/share",
    executionInfluence: "none",
  });
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    let title = "";
    let text = "";
    let url = "";
    const attachments: CaptureAttachmentInput[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      title = String(form.get("title") ?? form.get("name") ?? "");
      text = String(form.get("text") ?? form.get("description") ?? "");
      url = String(form.get("url") ?? form.get("link") ?? "");

      const files = [...form.getAll("file"), ...form.getAll("media")];
      for (const entry of files) {
        if (!(entry instanceof File)) continue;
        const validation = validateCaptureFile({
          fileName: entry.name,
          mimeType: entry.type || "application/octet-stream",
          sizeBytes: entry.size,
        });
        if (!validation.ok || !validation.kind) continue;
        if (
          validation.kind === "link" ||
          validation.kind === "video_link"
        ) {
          continue;
        }
        const buffer = Buffer.from(await entry.arrayBuffer());
        const ocr = await runOcr({
          kind: validation.kind,
          fileName: entry.name,
          mimeType: entry.type || "application/octet-stream",
          buffer,
        });
        attachments.push({
          kind: validation.kind,
          fileName: entry.name,
          mimeType: entry.type || "application/octet-stream",
          sizeBytes: entry.size,
          ocrText: ocr.text || undefined,
        });
      }
    } else {
      const body = (await req.json().catch(() => ({}))) as {
        title?: string;
        text?: string;
        url?: string;
        description?: string;
      };
      title = body.title ?? "";
      text = body.text ?? body.description ?? "";
      url = body.url ?? "";
    }

    const links = [url].filter((u) => isHttpUrl(u));
    if (links[0]) {
      attachments.push({
        kind: detectVideoLink(links[0]) ? "video_link" : "link",
        fileName: links[0],
        mimeType: "text/uri-list",
        sizeBytes: links[0].length,
        url: links[0],
      });
    }

    const description =
      text.trim() ||
      title.trim() ||
      url.trim() ||
      attachments.find((a) => a.ocrText)?.ocrText ||
      attachments[0]?.fileName ||
      "";

    if (!description) {
      return json(
        { error: "Nada para capturar", executionInfluence: "none" },
        400
      );
    }

    const result = await smartCapture({
      title: title || undefined,
      description,
      links,
      attachments,
      source: "share",
    });

    if (result.error) {
      return json({ error: result.error, executionInfluence: "none" }, 400);
    }

    return json({
      ok: true,
      memoryId: result.memoryId,
      cascade: result.cascade,
      executionInfluence: "none",
    });
  } catch (error) {
    console.error("[api/share]", error);
    return json(
      {
        error: error instanceof Error ? error.message : "Share capture failed",
        executionInfluence: "none",
      },
      500
    );
  }
}
