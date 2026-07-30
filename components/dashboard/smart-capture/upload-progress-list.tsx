"use client";

import type { UploadProgress } from "@/lib/smart-capture/types";

export function UploadProgressList({
  items,
  onCancel,
  onRetry,
}: {
  items: UploadProgress[];
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
}) {
  if (!items.length) return null;

  return (
    <ul className="space-y-2" data-testid="upload-progress-list">
      {items.map((u) => (
        <li
          key={u.id}
          className="rounded border border-white/10 bg-zinc-900/60 p-2"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="truncate text-[11px] text-zinc-300">
              {u.fileName}
            </span>
            <span className="shrink-0 text-[10px] text-zinc-500">
              {u.status === "uploading" && u.estimatedSecondsLeft != null
                ? `~${u.estimatedSecondsLeft}s`
                : u.status}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded bg-zinc-800">
            <div
              className={`h-full transition-all ${
                u.status === "error"
                  ? "bg-rose-500"
                  : u.status === "cancelled"
                    ? "bg-zinc-600"
                    : "bg-cyan-500"
              }`}
              style={{ width: `${u.percent}%` }}
            />
          </div>
          {u.error ? (
            <p className="mt-1 text-[10px] text-rose-400">{u.error}</p>
          ) : null}
          <div className="mt-1 flex gap-2">
            {u.status === "uploading" && onCancel ? (
              <button
                type="button"
                className="text-[10px] text-zinc-500 hover:text-zinc-300"
                onClick={() => onCancel(u.id)}
              >
                Cancelar
              </button>
            ) : null}
            {(u.status === "error" || u.status === "cancelled") && onRetry ? (
              <button
                type="button"
                className="text-[10px] text-cyan-400 hover:text-cyan-300"
                onClick={() => onRetry(u.id)}
              >
                Reenviar
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
