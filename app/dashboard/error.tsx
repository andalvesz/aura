"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard-error]", error.message, error.digest);
  }, [error]);

  const msg = error.message || "Erro inesperado";
  const correlation =
    (error as Error & { correlationId?: string }).correlationId ||
    error.digest ||
    null;
  const hint =
    /relation .* does not exist|column .* does not exist/i.test(msg)
      ? "Possível migration ausente — veja docs/operations/migration-order.md"
      : /JWT|session|auth/i.test(msg)
        ? "Sessão inválida — faça login novamente"
        : /permission|rls|policy/i.test(msg)
          ? "Acesso negado (RLS/papel)"
          : "Tente novamente. Widgets isolados não devem derrubar toda a Home.";

  return (
    <div className="mx-auto max-w-lg space-y-3 p-6" data-testid="dashboard-error">
      <h1 className="text-lg font-medium text-zinc-100">Algo falhou neste trecho</h1>
      <p className="text-[13px] text-zinc-400">{hint}</p>
      <p className="text-[11px] text-zinc-600">{msg.slice(0, 200)}</p>
      {correlation ? (
        <p className="text-[11px] text-zinc-500" data-testid="error-correlation-id">
          Correlation ID (suporte): {correlation}
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-zinc-200"
      >
        Tentar de novo
      </button>
    </div>
  );
}
