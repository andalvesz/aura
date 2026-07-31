"use client";

import Link from "next/link";
import type { SmartLinksBundle } from "@/lib/orchestrator/types";
import { flattenSmartLinks } from "@/lib/orchestrator/smart-links";

export function SmartLinksPanel({
  bundle,
  title = "Links inteligentes",
}: {
  bundle: SmartLinksBundle;
  title?: string;
}) {
  const links = flattenSmartLinks(bundle);
  if (!links.length) return null;

  const sections: Array<{ key: keyof SmartLinksBundle; label: string }> = [
    { key: "memories", label: "Memórias" },
    { key: "documents", label: "Documentos" },
    { key: "knowledge", label: "Knowledge" },
    { key: "plans", label: "Planos" },
    { key: "discovery", label: "Discovery" },
    { key: "decisions", label: "Decisões" },
    { key: "recommendations", label: "Recomendações" },
    { key: "agents", label: "Agentes" },
    { key: "automations", label: "Automações" },
  ];

  return (
    <div
      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
      data-testid="aura-smart-links"
    >
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map(({ key, label }) => {
          const items = bundle[key];
          if (!items.length) return null;
          return (
            <div key={key}>
              <p className="mb-1 text-[10px] text-zinc-500">{label}</p>
              <ul className="space-y-1">
                {items.map((l) => (
                  <li key={`${key}-${l.id}`}>
                    <Link
                      href={l.href}
                      className="text-[12px] text-zinc-300 hover:text-cyan-300"
                    >
                      {l.title}
                    </Link>
                    <span className="ml-1 text-[10px] text-zinc-600">
                      {l.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
