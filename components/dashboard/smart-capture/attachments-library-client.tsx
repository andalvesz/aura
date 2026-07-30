"use client";

import { useMemo, useState, useTransition } from "react";
import { searchAttachmentsAction } from "@/app/actions/smart-capture";
import { CapturePreviewCard } from "@/components/dashboard/smart-capture/capture-preview-card";
import { buildAttachmentPreview } from "@/lib/smart-capture/preview";
import type {
  MemoryAttachment,
  SmartCaptureSearchHit,
} from "@/lib/smart-capture/types";
import { FORM_INPUT_CLASS } from "@/utils/dashboard-mobile";

export function AttachmentsLibraryClient({
  initial,
}: {
  initial: MemoryAttachment[];
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SmartCaptureSearchHit[] | null>(null);
  const [pending, start] = useTransition();

  const visible = useMemo(() => {
    if (!hits) return initial;
    const ids = new Set(hits.map((h) => h.attachmentId));
    return initial.filter((a) => ids.has(a.id));
  }, [hits, initial]);

  return (
    <div className="space-y-3">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            if (query.trim().length < 2) {
              setHits(null);
              return;
            }
            const res = await searchAttachmentsAction(query.trim());
            setHits(res);
          });
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={FORM_INPUT_CLASS}
          placeholder="Buscar OCR, links, arquivos, tags…"
          data-testid="attachments-search"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded border border-white/10 px-3 text-[12px] text-zinc-300"
        >
          Buscar
        </button>
      </form>

      {hits ? (
        <p className="text-[11px] text-zinc-500">
          {hits.length} resultado(s)
        </p>
      ) : null}

      {!visible.length ? (
        <p className="rounded-lg border border-dashed border-white/10 p-6 text-center text-[13px] text-zinc-500">
          Nenhum anexo ainda. Use Smart Capture para adicionar.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((a) => (
            <li key={a.id} className="space-y-1">
              <CapturePreviewCard
                preview={buildAttachmentPreview({
                  kind: a.kind,
                  fileName: a.fileName,
                  mimeType: a.mimeType,
                  sizeBytes: a.sizeBytes,
                  url: a.url ?? undefined,
                  ocrText: a.ocrText ?? undefined,
                  linkPreview: a.linkPreview ?? undefined,
                })}
              />
              {a.ocrText ? (
                <p className="line-clamp-2 text-[10px] text-zinc-600">
                  OCR: {a.ocrText}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
