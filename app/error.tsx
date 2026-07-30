"use client";

import { useEffect } from "react";
import Link from "next/link";
import { prodError } from "@/lib/production/logger";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    prodError("route_error_boundary", {
      scope: "app.error",
      digest: error.digest,
      meta: {
        name: error.name,
        // message may be generic in production — still useful for digest matching
        hasMessage: Boolean(error.message),
      },
    });
  }, [error]);

  return (
    <main
      className="flex min-h-[70vh] items-center justify-center px-6 py-16"
      data-testid="error-500-page"
    >
      <div className="w-full max-w-md space-y-4 text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          500
        </p>
        <h1 className="text-2xl font-medium text-zinc-100">Algo deu errado</h1>
        <p className="text-[14px] text-zinc-400">
          Ocorreu um erro inesperado. Tente novamente. Se persistir, volte ao
          dashboard.
        </p>
        {error.digest ? (
          <p className="text-[11px] text-zinc-600">Ref: {error.digest}</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="inline-flex min-h-11 items-center rounded-md bg-cyan-500/90 px-4 text-[13px] font-medium text-zinc-950"
          >
            Tentar novamente
          </button>
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center rounded-md border border-white/10 px-4 text-[13px] text-zinc-300"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
