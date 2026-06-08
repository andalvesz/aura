"use client";

import { CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import {
  getV1StableSummary,
  V1_STABLE_CHECKLIST,
  type V1StableChecklistItem,
} from "@/utils/v1-stable-checklist";
import { cn } from "@/utils/cn";

export function V1StableChecklistPanel() {
  const summary = getV1StableSummary();

  return (
    <Panel className="border-sky-500/15 bg-sky-500/[0.02]">
      <PanelHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-sky-400" />
          <PanelTitle>Checklist V1 Stable</PanelTitle>
        </div>
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            summary.complete
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-amber-500/10 text-amber-400"
          )}
        >
          {summary.done}/{summary.total} concluídos
        </span>
      </PanelHeader>
      <PanelContent className="space-y-2 pt-0">
        <p className="text-[12px] text-zinc-500">
          Correções de alta prioridade da Auditoria Final — status, impacto e conclusão.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wide text-zinc-600">
                <th className="px-2 py-2 font-medium">Correção</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Impacto</th>
                <th className="px-2 py-2 font-medium">Concluído</th>
              </tr>
            </thead>
            <tbody>
              {V1_STABLE_CHECKLIST.map((item) => (
                <ChecklistRow key={item.id} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      </PanelContent>
    </Panel>
  );
}

function ChecklistRow({ item }: { item: V1StableChecklistItem }) {
  const done = item.status === "done";

  return (
    <tr className="border-b border-white/[0.04] last:border-0">
      <td className="px-2 py-2.5 font-medium text-zinc-200">{item.title}</td>
      <td className="px-2 py-2.5">
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
            done ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
          )}
        >
          {done ? "Resolvido" : "Pendente"}
        </span>
      </td>
      <td className="px-2 py-2.5 text-zinc-500">{item.impact}</td>
      <td className="px-2 py-2.5">
        {done ? (
          <CheckCircle2 className="size-4 text-emerald-400" aria-label="Concluído" />
        ) : (
          <Circle className="size-4 text-zinc-600" aria-label="Pendente" />
        )}
      </td>
    </tr>
  );
}
