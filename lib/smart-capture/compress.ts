/**
 * Image compression helpers (browser-safe API shape + pure size estimate).
 */

export type CompressImageOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: "image/jpeg" | "image/webp";
};

export function estimateCompressedBytes(
  originalBytes: number,
  quality = 0.72
): number {
  const q = Math.min(1, Math.max(0.1, quality));
  return Math.max(1024, Math.round(originalBytes * (0.35 + q * 0.4)));
}

/**
 * Compress image in the browser via canvas. No-op on server.
 */
export async function compressImageBlob(
  blob: Blob,
  options: CompressImageOptions = {}
): Promise<Blob> {
  if (typeof document === "undefined") return blob;
  if (!blob.type.startsWith("image/") || blob.type === "image/gif") return blob;

  const maxWidth = options.maxWidth ?? 1920;
  const maxHeight = options.maxHeight ?? 1920;
  const quality = options.quality ?? 0.72;
  const mimeType = options.mimeType ?? "image/jpeg";

  const bitmap = await createImageBitmap(blob);
  try {
    let { width, height } = bitmap;
    const scale = Math.min(1, maxWidth / width, maxHeight / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), mimeType, quality)
    );
    if (!out || out.size >= blob.size) return blob;
    return out;
  } finally {
    bitmap.close();
  }
}
