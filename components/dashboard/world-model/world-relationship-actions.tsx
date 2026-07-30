"use client";

import { useState, useTransition } from "react";
import {
  archiveWorldRelationshipAction,
  confirmWorldRelationshipAction,
  rejectWorldRelationshipAction,
} from "@/app/actions/world-model";
import type { WorldRelationship } from "@/lib/world-model/types";

export function WorldRelationshipActions({
  relationship,
}: {
  relationship: WorldRelationship;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error: string | null }>) => {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res.error) setMsg(res.error);
    });
  };

  return (
    <div className="mt-2 flex flex-wrap gap-1.5" data-testid="world-rel-actions">
      {relationship.status !== "CONFIRMED" &&
      relationship.status !== "REJECTED" &&
      relationship.status !== "ARCHIVED" ? (
        <button
          type="button"
          disabled={pending}
          className="rounded border border-emerald-500/30 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/10"
          data-testid="world-rel-confirm"
          onClick={() => run(() => confirmWorldRelationshipAction(relationship.id))}
        >
          Confirmar
        </button>
      ) : null}
      {relationship.status !== "REJECTED" &&
      relationship.status !== "ARCHIVED" ? (
        <button
          type="button"
          disabled={pending}
          className="rounded border border-rose-500/30 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/10"
          data-testid="world-rel-reject"
          onClick={() =>
            run(() =>
              rejectWorldRelationshipAction(
                relationship.id,
                "Rejeitada na UI do Mapa do Aura"
              )
            )
          }
        >
          Rejeitar
        </button>
      ) : null}
      {relationship.status !== "ARCHIVED" ? (
        <button
          type="button"
          disabled={pending}
          className="rounded border border-white/10 px-2 py-1 text-[11px] text-zinc-500 hover:bg-white/5"
          onClick={() => run(() => archiveWorldRelationshipAction(relationship.id))}
        >
          Arquivar
        </button>
      ) : null}
      {msg ? (
        <p className="w-full text-[11px] text-rose-400" role="alert">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
