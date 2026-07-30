"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const TYPE_OPTIONS = [
  { value: "", label: "Todos os tipos" },
  { value: "OPPORTUNITY", label: "Oportunidades" },
  { value: "RISK", label: "Riscos" },
  { value: "GAP", label: "Lacunas" },
  { value: "DEPENDENCY", label: "Dependências" },
  { value: "STAGNATION", label: "Estagnação" },
  { value: "DUPLICATE", label: "Duplicações" },
  { value: "UNKNOWN", label: "Necessita confirmação" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "PENDING_CONFIRMATION", label: "Pendente" },
  { value: "CONFIRMED", label: "Confirmado" },
  { value: "REJECTED", label: "Rejeitado" },
  { value: "ARCHIVED", label: "Arquivado" },
];

export function DiscoveryFiltersBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    start(() => {
      router.push(`/dashboard/discovery?${next.toString()}`);
    });
  };

  return (
    <div
      className="flex flex-wrap gap-2"
      data-testid="discovery-filters"
    >
      <select
        className="rounded border border-white/10 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300"
        value={params.get("type") ?? ""}
        disabled={pending}
        onChange={(e) => update("type", e.target.value)}
      >
        {TYPE_OPTIONS.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className="rounded border border-white/10 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300"
        value={params.get("status") ?? ""}
        disabled={pending}
        onChange={(e) => update("status", e.target.value)}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value || "all-status"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className="rounded border border-white/10 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300"
        value={params.get("confidence") ?? ""}
        disabled={pending}
        onChange={(e) => update("confidence", e.target.value)}
      >
        <option value="">Confiança</option>
        <option value="40">≥ 40%</option>
        <option value="60">≥ 60%</option>
        <option value="70">≥ 70%</option>
      </select>
      <input
        type="date"
        className="rounded border border-white/10 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300"
        value={params.get("from") ?? ""}
        disabled={pending}
        onChange={(e) => update("from", e.target.value)}
        aria-label="Período de"
      />
      <input
        type="date"
        className="rounded border border-white/10 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300"
        value={params.get("to") ?? ""}
        disabled={pending}
        onChange={(e) => update("to", e.target.value)}
        aria-label="Período até"
      />
    </div>
  );
}
