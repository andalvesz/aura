"use client";

import { useState, useTransition } from "react";
import { createManualMemoryAction } from "@/app/actions/memory";

export function MemoryManualEntry() {
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<
    "fato" | "acontecimento" | "procedimento" | "correcao" | "nota"
  >("fato");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="space-y-2"
      data-testid="memory-manual-entry"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const res = await createManualMemoryAction({ kind, title, content });
          if (res.error) setMsg(res.error);
          else {
            setTitle("");
            setContent("");
            setMsg("Memória registrada.");
          }
        });
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-[10px] text-zinc-600">Tipo</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className="w-full rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-[12px] text-zinc-100"
          >
            <option value="fato">Fato</option>
            <option value="acontecimento">Acontecimento</option>
            <option value="procedimento">Procedimento</option>
            <option value="correcao">Correção</option>
            <option value="nota">Nota importante</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] text-zinc-600">Título</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-[12px] text-zinc-100"
            required
          />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-[10px] text-zinc-600">Conteúdo</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="w-full rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-[12px] text-zinc-100"
          required
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-900 disabled:opacity-40"
      >
        Guardar memória
      </button>
      {msg ? (
        <p className="text-[11px] text-zinc-500" role="status">
          {msg}
        </p>
      ) : null}
    </form>
  );
}
