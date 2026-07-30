"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bootstrapDiscoveryEngineAction } from "@/app/actions/discovery";

type BootstrapUiResult = {
  error: string | null;
  generated?: number;
  outcome?: string;
  message?: string;
  correlationId?: string;
};

export function DiscoveryBootstrapButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<BootstrapUiResult | null>(null);
  const locked = useRef(false);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending || locked.current}
        data-testid="discovery-bootstrap"
        aria-busy={pending}
        className="rounded border border-cyan-500/30 px-3 py-1.5 text-[12px] text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-40"
        onClick={() => {
          if (pending || locked.current) return;
          locked.current = true;
          setResult(null);
          start(async () => {
            try {
              const res = await bootstrapDiscoveryEngineAction();
              setResult(res);
              if (!res.error && res.outcome !== "migration_pending") {
                router.refresh();
              }
            } finally {
              locked.current = false;
            }
          });
        }}
      >
        {pending ? "Atualizando…" : "Atualizar descobertas"}
      </button>
      {result ? (
        <p
          className={`max-w-xs text-right text-[11px] ${
            result.error || result.outcome === "error"
              ? "text-rose-400"
              : result.outcome === "migration_pending"
                ? "text-amber-400"
                : "text-zinc-500"
          }`}
          data-testid="discovery-bootstrap-message"
          data-correlation-id={result.correlationId}
        >
          {result.error ?? result.message}
          {result.correlationId ? (
            <span className="mt-0.5 block text-[10px] text-zinc-600">
              ref {result.correlationId}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
