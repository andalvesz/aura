"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  listBrainNotificationsAction,
  markBrainNotificationReadAction,
} from "@/app/actions/daily";
import type { BrainNotification } from "@/lib/daily/types";

export function BrainNotificationsPanel() {
  const [items, setItems] = useState<BrainNotification[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    void listBrainNotificationsAction(true).then(setItems);
  }, []);

  if (!items.length) return null;

  return (
    <section
      className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-3"
      data-testid="brain-notifications"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-amber-400/80">
        Notificações do Brain
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.slice(0, 5).map((n) => (
          <li key={n.id} className="flex items-start justify-between gap-2 text-[12px]">
            <div className="min-w-0">
              {n.href ? (
                <Link href={n.href} className="text-zinc-200 hover:text-cyan-300">
                  {n.title}
                </Link>
              ) : (
                <span className="text-zinc-200">{n.title}</span>
              )}
              {n.message ? (
                <p className="text-[11px] text-zinc-500">{n.message}</p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={pending}
              className="shrink-0 text-[10px] text-zinc-500 hover:text-zinc-300"
              onClick={() =>
                start(async () => {
                  await markBrainNotificationReadAction(n.id);
                  setItems((prev) => prev.filter((x) => x.id !== n.id));
                })
              }
            >
              Lida
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
