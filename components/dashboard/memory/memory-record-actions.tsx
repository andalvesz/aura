"use client";

import { useState, useTransition } from "react";
import {
  archiveMemoryAction,
  confirmMemoryAction,
  correctMemoryAction,
  disputeMemoryAction,
  forgetMemoryAction,
  promoteMemoryAction,
} from "@/app/actions/memory";
import type { MemoryRecord } from "@/lib/memory/types";

export function MemoryRecordActions({ memory }: { memory: MemoryRecord }) {
  const [pending, start] = useTransition();
  const [correctOpen, setCorrectOpen] = useState(false);
  const [correctValue, setCorrectValue] = useState(memory.content);
  const [explainOpen, setExplainOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error: string | null }>) => {
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res.error) setMsg(res.error);
    });
  };

  return (
    <div className="mt-2 space-y-2" data-testid="memory-record-actions">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={pending}
          className="rounded border border-white/10 px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/5"
          onClick={() => setExplainOpen((v) => !v)}
        >
          Explicar
        </button>
        {memory.status !== "CONFIRMED" &&
        memory.status !== "REJECTED" &&
        memory.status !== "ARCHIVED" &&
        memory.status !== "DELETED" ? (
          <button
            type="button"
            disabled={pending}
            className="rounded border border-emerald-500/30 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40"
            data-testid="memory-confirm"
            onClick={() => run(() => confirmMemoryAction(memory.id))}
          >
            Confirmar
          </button>
        ) : null}
        {memory.status !== "DISPUTED" &&
        memory.status !== "REJECTED" &&
        memory.status !== "ARCHIVED" ? (
          <button
            type="button"
            disabled={pending}
            className="rounded border border-amber-500/30 px-2 py-1 text-[11px] text-amber-300 hover:bg-amber-500/10"
            data-testid="memory-dispute"
            onClick={() =>
              run(() =>
                disputeMemoryAction(memory.id, "Contestado pelo usuário na UI")
              )
            }
          >
            Contestar
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          className="rounded border border-white/10 px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/5"
          onClick={() => setCorrectOpen((v) => !v)}
        >
          Corrigir
        </button>
        {memory.status !== "ARCHIVED" ? (
          <button
            type="button"
            disabled={pending}
            className="rounded border border-white/10 px-2 py-1 text-[11px] text-zinc-500 hover:bg-white/5"
            onClick={() => run(() => archiveMemoryAction(memory.id))}
          >
            Arquivar
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          className="rounded border border-white/10 px-2 py-1 text-[11px] text-zinc-600 hover:bg-white/5"
          data-testid="memory-forget"
          onClick={() => run(() => forgetMemoryAction(memory.id))}
        >
          Esquecer
        </button>
        {memory.memoryType === "SEMANTIC" &&
        memory.promotionStatus === "NONE" ? (
          <button
            type="button"
            disabled={pending}
            className="rounded border border-sky-500/30 px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/10"
            data-testid="memory-promote"
            onClick={() => run(() => promoteMemoryAction(memory.id))}
          >
            Avaliar Identity
          </button>
        ) : null}
      </div>
      {explainOpen ? (
        <pre
          className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-2 text-[10px] text-zinc-500"
          data-testid="memory-explain"
        >
          {`Por que o Aura guardou isso?\nOrigem: ${memory.sourceType}\nContexto: ${memory.context}\nConfiança: ${memory.confidence}% · Importância: ${memory.importance}\nRetenção: ${memory.retentionPolicy}\nPromoção: ${memory.promotionStatus}\nInfluência em Identity: ${
            memory.promotionStatus === "PROPOSED_IDENTITY" ||
            memory.promotionStatus === "ATTACHED_EVIDENCE"
              ? "avaliada / proposta"
              : "nenhuma (ainda)"
          }\nComo corrigir: use Corrigir, Contestar ou Esquecer.`}
        </pre>
      ) : null}
      {correctOpen ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-[12rem] flex-1 space-y-1">
            <span className="text-[10px] text-zinc-600">Conteúdo corrigido</span>
            <input
              value={correctValue}
              onChange={(e) => setCorrectValue(e.target.value)}
              className="w-full rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-[12px] text-zinc-100"
              data-testid="memory-correct-input"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            className="rounded bg-zinc-100 px-2 py-1.5 text-[11px] font-medium text-zinc-900"
            data-testid="memory-correct-submit"
            onClick={() =>
              run(async () => {
                const res = await correctMemoryAction({
                  memoryId: memory.id,
                  content: correctValue,
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
