"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { toggleFavoriteAction } from "@/app/actions/daily";
import { updateFavoritePinsAction } from "@/app/actions/smart-capture";
import type { DailyFavorite, FavoritePinSurface } from "@/lib/daily/types";
import { PIN_LABELS, togglePinPure } from "@/lib/smart-capture/pins";

export function FavoritesClient({ items }: { items: DailyFavorite[] }) {
  const [pending, start] = useTransition();

  return (
    <ul className="space-y-2" data-testid="favorites-list">
      {items.map((f) => (
        <li
          key={f.id}
          className="rounded-lg border border-white/[0.06] bg-zinc-950/50 px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase text-zinc-600">
                {f.targetType}
              </p>
              <Link
                href={f.href}
                className="text-[13px] text-zinc-200 hover:text-cyan-300"
              >
                {f.title}
              </Link>
            </div>
            <button
              type="button"
              disabled={pending}
              className="min-h-11 shrink-0 px-2 text-[10px] text-zinc-500 hover:text-rose-300"
              onClick={() =>
                start(async () => {
                  await toggleFavoriteAction({
                    targetType: f.targetType,
                    targetId: f.targetId,
                    title: f.title,
                    href: f.href,
                  });
                  toast.success("Removido dos favoritos");
                })
              }
            >
              Remover
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(Object.keys(PIN_LABELS) as FavoritePinSurface[]).map((surface) => {
              const on = (f.pins ?? []).includes(surface);
              return (
                <button
                  key={surface}
                  type="button"
                  disabled={pending}
                  className={`rounded border px-2 py-1 text-[10px] ${
                    on
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                      : "border-white/10 text-zinc-500"
                  }`}
                  onClick={() =>
                    start(async () => {
                      const pins = togglePinPure(f.pins ?? [], surface);
                      const res = await updateFavoritePinsAction({
                        targetType: f.targetType,
                        targetId: f.targetId,
                        pins,
                      });
                      if (res.error) toast.error(res.error);
                      else toast.success(PIN_LABELS[surface]);
                    })
                  }
                >
                  {PIN_LABELS[surface]}
                </button>
              );
            })}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function FavoriteButton({
  targetType,
  targetId,
  title,
  href,
}: {
  targetType: DailyFavorite["targetType"];
  targetId: string;
  title: string;
  href: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      data-testid="favorite-toggle"
      className="min-h-11 rounded border border-amber-500/30 px-2 py-1 text-[10px] text-amber-300/90 hover:bg-amber-500/10 disabled:opacity-40 md:min-h-0 md:py-0.5"
      onClick={() =>
        start(async () => {
          const res = await toggleFavoriteAction({
            targetType,
            targetId,
            title,
            href,
          });
          toast.success(res.removed ? "Removido dos favoritos" : "Favoritado");
        })
      }
    >
      ★ Favorito
    </button>
  );
}
