"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { updateInboxAction } from "@/app/actions/daily";
import type { InboxItem } from "@/lib/daily/types";
import { EmptyState } from "@/components/dashboard/empty-state";

export function InboxClient({
  items,
  filter,
}: {
  items: InboxItem[];
  filter: string;
}) {
  const [pending, start] = useTransition();
  const [tagDraft, setTagDraft] = useState<Record<string, string>>({});

  if (!items.length) {
    return (
      <EmptyState
        title="Inbox vazia"
        description="Registre sua primeira memória com o botão + Nova Memória."
        action={
          <p className="text-[11px] text-zinc-600">
            Atalho: Ctrl/Cmd+M
          </p>
        }
      />
    );
  }

  return (
    <ul className="space-y-2" data-testid="inbox-list" data-filter={filter}>
      {items.map((item) => (
        <li
          key={item.memoryId}
          className="rounded-lg border border-white/[0.06] bg-zinc-950/60 p-3"
          data-testid="inbox-item"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] text-zinc-100">{item.title}</p>
              <p className="mt-1 text-[12px] text-zinc-500">{item.summary}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-600">
                {item.status} · {item.visibilityScope} ·{" "}
                {new Date(item.createdAt).toLocaleString("pt-BR")}
              </p>
              {item.tags.length ? (
                <p className="mt-1 text-[11px] text-cyan-400/80">
                  {item.tags.join(" · ")}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={tagDraft[item.memoryId] ?? item.tags.join(", ")}
              onChange={(e) =>
                setTagDraft((d) => ({ ...d, [item.memoryId]: e.target.value }))
              }
              placeholder="tags"
              className="min-w-[8rem] flex-1 rounded border border-white/10 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200"
            />
            <button
              type="button"
              disabled={pending}
              className="rounded border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-300 disabled:opacity-40"
              onClick={() =>
                start(async () => {
                  const tags = (tagDraft[item.memoryId] ?? "")
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean);
                  const res = await updateInboxAction({
                    memoryId: item.memoryId,
                    status: "classified",
                    tags,
                  });
                  if (res.error) toast.error(res.error);
                  else toast.success("Convertida em memória definitiva");
                })
              }
            >
              Memória definitiva
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded border border-zinc-600/40 px-2 py-1 text-[10px] text-zinc-400 disabled:opacity-40"
              onClick={() =>
                start(async () => {
                  const res = await updateInboxAction({
                    memoryId: item.memoryId,
                    status: "archived",
                  });
                  if (res.error) toast.error(res.error);
                  else toast.success("Arquivada");
                })
              }
            >
              Arquivar
            </button>
            <Link
              href={`/dashboard/settings/memory#${item.memoryId}`}
              className="text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              Editar
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
