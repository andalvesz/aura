"use client";

import { useState, useTransition } from "react";
import { bootstrapWorldModelAction } from "@/app/actions/world-model";

export function WorldBootstrapButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        className="rounded bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-900 disabled:opacity-40"
        data-testid="world-bootstrap"
        onClick={() =>
          start(async () => {
            const res = await bootstrapWorldModelAction();
            setMsg(
              res.error
                ? res.error
                : `Bootstrap ok — ${res.created ?? 0} itens criados/atualizados`
            );
          })
        }
      >
        Atualizar mapa a partir de dados confirmados
      </button>
      {msg ? (
        <p className="text-[11px] text-zinc-500" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
