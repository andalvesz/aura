"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function DiscoverySearch({ initialQuery }: { initialQuery?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery ?? "");
  const [pending, start] = useTransition();

  return (
    <form
      className="flex gap-2"
      data-testid="discovery-search"
      onSubmit={(e) => {
        e.preventDefault();
        start(() => {
          const params = new URLSearchParams();
          if (q.trim()) params.set("q", q.trim());
          router.push(`/dashboard/discovery?${params.toString()}`);
        });
      }}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar memórias, entidades, insights, descobertas…"
        className="min-w-0 flex-1 rounded border border-white/10 bg-zinc-950 px-3 py-1.5 text-[12px] text-zinc-200 placeholder:text-zinc-600"
        aria-label="Busca Aura Brain"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-white/10 px-3 py-1.5 text-[12px] text-zinc-300 hover:bg-white/5 disabled:opacity-40"
      >
        Buscar
      </button>
    </form>
  );
}
