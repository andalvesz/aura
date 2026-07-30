"use client";

import { useState, useTransition } from "react";
import { createIdentityClaimAction } from "@/app/actions/identity";

export function IdentityManualEntry() {
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [category, setCategory] = useState("preference");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-2"
      data-testid="identity-manual-entry"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const key = label
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_|_$/g, "")
            .slice(0, 64);
          const res = await createIdentityClaimAction({
            category,
            key: key || `manual_${Date.now()}`,
            value,
            label,
            sourceType: "manual_entry",
            confirmNow: true,
            evidenceSummary: "Entrada manual do usuário",
          });
          if (res.error) setError(res.error);
          else {
            setLabel("");
            setValue("");
          }
        });
      }}
    >
      <p className="text-[11px] text-zinc-600">
        Entrada manual é apoio — o foco é revisar o que o Aura aprendeu.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-[12px] text-zinc-100"
        >
          <option value="preference">preference</option>
          <option value="skill">skill</option>
          <option value="interest">interest</option>
          <option value="role">role</option>
          <option value="goal">goal</option>
          <option value="communication">communication</option>
          <option value="constraint">constraint</option>
        </select>
        <input
          required
          placeholder="Rótulo"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-[12px] text-zinc-100"
        />
        <input
          required
          placeholder="Valor"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded border border-white/10 bg-zinc-950 px-2 py-1.5 text-[12px] text-zinc-100"
        />
      </div>
      {error ? (
        <p className="text-[11px] text-rose-400" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-100 px-2.5 py-1.5 text-[11px] font-medium text-zinc-900 disabled:opacity-50"
      >
        {pending ? "Salvando…" : "Adicionar (confirmado)"}
      </button>
    </form>
  );
}
