/**
 * Favorite pins — Home / Search / Feed surfaces.
 */

import type { FavoritePinSurface } from "@/lib/smart-capture/types";
import type { DailyFavorite } from "@/lib/daily/types";

export type PinnedFavorite = DailyFavorite & {
  pins: FavoritePinSurface[];
};

export function normalizePins(pins?: FavoritePinSurface[]): FavoritePinSurface[] {
  if (!pins?.length) return [];
  const allowed: FavoritePinSurface[] = ["home", "search", "feed"];
  const seen = new Set<FavoritePinSurface>();
  const out: FavoritePinSurface[] = [];
  for (const p of pins) {
    if (!allowed.includes(p) || seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

export function togglePinPure(
  pins: FavoritePinSurface[],
  surface: FavoritePinSurface
): FavoritePinSurface[] {
  if (pins.includes(surface)) {
    return pins.filter((p) => p !== surface);
  }
  return normalizePins([...pins, surface]);
}

export function filterFavoritesByPin(
  favorites: Array<DailyFavorite & { pins?: FavoritePinSurface[] }>,
  surface: FavoritePinSurface
): Array<DailyFavorite & { pins?: FavoritePinSurface[] }> {
  return favorites.filter((f) => (f.pins ?? []).includes(surface));
}

export const PIN_LABELS: Record<FavoritePinSurface, string> = {
  home: "Fixar na Home",
  search: "Fixar na Busca",
  feed: "Fixar no Feed",
};
