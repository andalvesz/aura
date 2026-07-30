"use client";

import type { CapturePreview } from "@/lib/smart-capture/preview";

export function CapturePreviewCard({ preview }: { preview: CapturePreview }) {
  if (preview.kind === "none") return null;

  if (preview.kind === "image") {
    return (
      <figure
        className="overflow-hidden rounded-lg border border-white/10 bg-zinc-900"
        data-testid="preview-image"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview.url}
          alt={preview.fileName}
          className="max-h-40 w-full object-contain"
          loading="lazy"
        />
        <figcaption className="truncate px-2 py-1 text-[10px] text-zinc-500">
          {preview.fileName}
        </figcaption>
      </figure>
    );
  }

  if (preview.kind === "pdf") {
    return (
      <div
        className="rounded-lg border border-white/10 bg-zinc-900 p-2"
        data-testid="preview-pdf"
      >
        <p className="text-[11px] text-zinc-400">PDF · {preview.fileName}</p>
        <a
          href={preview.url}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-[12px] text-cyan-300 hover:underline"
        >
          Abrir preview
        </a>
      </div>
    );
  }

  if (preview.kind === "link") {
    const p = preview.preview;
    return (
      <a
        href={p.url}
        target="_blank"
        rel="noreferrer"
        className="flex gap-2 rounded-lg border border-white/10 bg-zinc-900 p-2 hover:border-cyan-500/30"
        data-testid="preview-link"
      >
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.image}
            alt=""
            className="size-14 shrink-0 rounded object-cover"
            loading="lazy"
          />
        ) : p.favicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.favicon} alt="" className="size-8 shrink-0" loading="lazy" />
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-[12px] text-zinc-100">
            {p.title ?? p.url}
          </p>
          {p.description ? (
            <p className="line-clamp-2 text-[10px] text-zinc-500">
              {p.description}
            </p>
          ) : null}
        </div>
      </a>
    );
  }

  if (preview.kind === "audio") {
    return (
      <div
        className="rounded-lg border border-white/10 bg-zinc-900 p-2"
        data-testid="preview-audio"
      >
        <p className="mb-1 text-[11px] text-zinc-400">{preview.fileName}</p>
        <audio controls preload="none" src={preview.url} className="w-full" />
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-400"
      data-testid="preview-file"
    >
      {preview.fileName} · {preview.mimeType}
    </div>
  );
}
