"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveDiscoveryAction,
  confirmDiscoveryAction,
  rejectDiscoveryAction,
  suppressSimilarDiscoveryAction,
} from "@/app/actions/discovery";

export function DiscoveryArtifactActions({
  artifactId,
  rowVersion,
  showOpen = false,
}: {
  artifactId: string;
  rowVersion?: number;
  showOpen?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const run = (
    fn: () => Promise<{ error: string | null; conflict?: boolean }>
  ) => {
    setMessage(null);
    start(async () => {
      const res = await fn();
      if (res.conflict) {
        setMessage(
          "Outro membro atualizou esta descoberta. Recarregando…"
        );
        router.refresh();
        return;
      }
      if (res.error) {
        setMessage(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div
      className="mt-2 space-y-1"
      data-testid="discovery-artifact-actions"
    >
      <div className="flex flex-wrap gap-1.5">
        {showOpen ? (
          <a
            href={`/dashboard/discovery?id=${artifactId}`}
            className="rounded border border-cyan-500/30 px-2 py-0.5 text-[10px] text-cyan-300/90 hover:bg-cyan-500/10"
            data-testid="discovery-open"
          >
            Abrir
          </a>
        ) : null}
        <button
          type="button"
          disabled={pending}
          className="rounded border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-300/90 hover:bg-emerald-500/10 disabled:opacity-40"
          onClick={() =>
            run(() => confirmDiscoveryAction(artifactId, rowVersion))
          }
        >
          Confirmar
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded border border-rose-500/30 px-2 py-0.5 text-[10px] text-rose-300/90 hover:bg-rose-500/10 disabled:opacity-40"
          onClick={() =>
            run(() =>
              rejectDiscoveryAction(
                artifactId,
                "rejeitado pelo usuário",
                rowVersion
              )
            )
          }
        >
          Rejeitar
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded border border-zinc-600/40 px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-800 disabled:opacity-40"
          onClick={() =>
            run(() => archiveDiscoveryAction(artifactId, rowVersion))
          }
        >
          Arquivar
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded border border-violet-500/30 px-2 py-0.5 text-[10px] text-violet-300/90 hover:bg-violet-500/10 disabled:opacity-40"
          onClick={() =>
            run(() =>
              suppressSimilarDiscoveryAction(
                artifactId,
                "silenciar semelhantes",
                rowVersion
              )
            )
          }
        >
          Silenciar semelhantes
        </button>
      </div>
      {message ? (
        <p className="text-[10px] text-amber-400" data-testid="discovery-conflict">
          {message}
        </p>
      ) : null}
      <p className="text-[10px] text-zinc-600">
        Confirmar não torna isso uma decisão operacional — o Aura ainda não executa.
      </p>
    </div>
  );
}
