"use client";

import { useState, useTransition } from "react";
import {
  archiveIdentityClaimAction,
  confirmIdentityClaimAction,
  correctIdentityClaimAction,
  deleteIdentityClaimAction,
  rejectIdentityClaimAction,
} from "@/app/actions/identity";
import type { IdentityClaim } from "@/lib/identity/types";

export function IdentityClaimActions({ claim }: { claim: IdentityClaim }) {
  const [pending, start] = useTransition();
  const [correctOpen, setCorrectOpen] = useState(false);
  const [correctValue, setCorrectValue] = useState(
    typeof claim.value === "string" ? claim.value : JSON.stringify(claim.value)
  );
  const [msg, setMsg] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error: string | null }>) => {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res.error) setMsg(res.error);
    });
  };

  return (
    <div className="mt-2 space-y-2" data-testid="identity-claim-actions">
      <div className="flex flex-wrap gap-1.5">
        {claim.status !== "CONFIRMED" && claim.status !== "REJECTED" && claim.status !== "ARCHIVED" ? (
          <button
            type="button"
            disabled={pending}
            className="rounded border border-emerald-500/30 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40"
            data-testid="identity-confirm"
            onClick={() => run(() => confirmIdentityClaimAction(claim.id))}
          >
            Confirmar
          </button>
        ) : null}
        {claim.status !== "REJECTED" && claim.status !== "ARCHIVED" ? (
          <button
            type="button"
            disabled={pending}
            className="rounded border border-rose-500/30 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"
            data-testid="identity-reject"
            onClick={() =>
              run(() =>
                rejectIdentityClaimAction(claim.id, "Rejeitado pelo usuário na UI")
              )
            }
          >
            Rejeitar
          </button>
        ) : null}
        {claim.status !== "ARCHIVED" ? (
          <button
            type="button"
            disabled={pending}
            className="rounded border border-white/10 px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/5"
            onClick={() => setCorrectOpen((v) => !v)}
          >
            Corrigir
          </button>
        ) : null}
        {claim.status !== "ARCHIVED" ? (
          <button
            type="button"
            disabled={pending}
            className="rounded border border-white/10 px-2 py-1 text-[11px] text-zinc-500 hover:bg-white/5"
            onClick={() => run(() => archiveIdentityClaimAction(claim.id))}
          >
            Arquivar
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          className="rounded border border-white/10 px-2 py-1 text-[11px] text-zinc-600 hover:bg-white/5"
          onClick={() => run(() => deleteIdentityClaimAction(claim.id))}
        >
          Excluir
        </button>
      </div>
      {correctOpen ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-[12rem] flex-1 space-y-1">
            <span className="text-[10px] text-zinc-600">Novo valor</span>
            <input
              value={correctValue}
              onChange={(e) => setCorrectValue(e.target.value)}
              className="w-full rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-[12px] text-zinc-100"
              data-testid="identity-correct-input"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            className="rounded bg-zinc-100 px-2 py-1.5 text-[11px] font-medium text-zinc-900"
            data-testid="identity-correct-submit"
            onClick={() =>
              run(async () => {
                const res = await correctIdentityClaimAction({
                  claimId: claim.id,
                  value: correctValue,
                  reason: "Correção explícita na UI",
                });
                if (!res.error) setCorrectOpen(false);
                return res;
              })
            }
          >
            Salvar correção
          </button>
        </div>
      ) : null}
      {msg ? (
        <p className="text-[11px] text-rose-400" role="alert">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
