"use client";

import { Brain } from "lucide-react";
import { useEffect, useState } from "react";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import type { RecentMemoriesSnapshot } from "@/lib/supabase/services/memory.service";
import { formatDate } from "@/utils/format";
import { parseJsonResponse } from "@/utils/safe-json";

export function RecentMemoriesCard() {
  const [snapshot, setSnapshot] = useState<RecentMemoriesSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/memory/recent");
        const { data, error } = await parseJsonResponse<RecentMemoriesSnapshot>(res);
        if (!cancelled && !error && data) {
          setSnapshot(data);
        }
      } catch {
        if (!cancelled) setSnapshot(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = [
    {
      label: "Última conversa",
      value: snapshot?.lastConversation?.preview,
      hint: snapshot?.lastConversation
        ? `${snapshot.lastConversation.moduleLabel} · ${formatDate(snapshot.lastConversation.at.slice(0, 10))}`
        : undefined,
    },
    {
      label: "Última meta",
      value: snapshot?.lastGoal?.title,
      hint: snapshot?.lastGoal?.detail,
    },
    {
      label: "Último treino",
      value: snapshot?.lastWorkout?.preview,
      hint: snapshot?.lastWorkout
        ? formatDate(snapshot.lastWorkout.at.slice(0, 10))
        : undefined,
    },
    {
      label: "Última análise",
      value: snapshot?.lastAnalysis?.preview,
      hint: snapshot?.lastAnalysis?.moduleLabel,
    },
  ];

  return (
    <Panel>
      <PanelHeader>
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-violet-400" />
          <PanelTitle>Memórias recentes</PanelTitle>
        </div>
      </PanelHeader>
      <PanelContent className="pt-0">
        {loading ? (
          <ListSkeleton rows={4} />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <li
                key={item.label}
                className="rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
              >
                <p className="text-[10px] uppercase tracking-wide text-zinc-600">
                  {item.label}
                </p>
                <p className="mt-1 text-[13px] text-zinc-200">
                  {item.value ?? "—"}
                </p>
                {item.hint && (
                  <p className="mt-0.5 text-[11px] text-zinc-600">{item.hint}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </PanelContent>
    </Panel>
  );
}
