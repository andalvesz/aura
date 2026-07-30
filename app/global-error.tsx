"use client";

import { useEffect } from "react";
import { prodError } from "@/lib/production/logger";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    prodError("global_error_boundary", {
      scope: "app.global-error",
      digest: error.digest,
      meta: { name: error.name, hasMessage: Boolean(error.message) },
    });
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <main
          className="flex min-h-screen items-center justify-center px-6 py-16"
          data-testid="global-error-page"
        >
          <div className="w-full max-w-md space-y-4 text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              500
            </p>
            <h1 className="text-2xl font-medium">Aura Brain indisponível</h1>
            <p className="text-[14px] text-zinc-400">
              Falha crítica ao carregar a aplicação. Tente novamente em instantes.
            </p>
            {error.digest ? (
              <p className="text-[11px] text-zinc-600">Ref: {error.digest}</p>
            ) : null}
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="inline-flex min-h-11 items-center rounded-md bg-cyan-500 px-4 text-[13px] font-medium text-zinc-950"
            >
              Tentar novamente
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
