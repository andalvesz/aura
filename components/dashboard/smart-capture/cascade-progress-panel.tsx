"use client";

import type { CascadeProgressStep } from "@/lib/smart-capture/types";

export function CascadeProgressPanel({
  steps,
  visible,
}: {
  steps: CascadeProgressStep[];
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <div
      className="mt-3 space-y-1.5 rounded-lg border border-white/10 bg-zinc-900/80 p-3"
      data-testid="cascade-progress"
    >
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">
        Processando captura
      </p>
      <ul className="space-y-1">
        {steps.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-2 text-[12px]"
            data-status={s.status}
          >
            <span className="text-zinc-300">{s.label}</span>
            <span
              className={
                s.status === "done"
                  ? "text-emerald-400"
                  : s.status === "running"
                    ? "text-cyan-300"
                    : s.status === "error"
                      ? "text-rose-400"
                      : "text-zinc-600"
              }
            >
              {s.status === "done"
                ? "ok"
                : s.status === "running"
                  ? "…"
                  : s.status === "error"
                    ? "erro"
                    : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
