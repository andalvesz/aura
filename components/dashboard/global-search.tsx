"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Building2,
  CalendarDays,
  Dumbbell,
  Loader2,
  Rocket,
  Search,
  Share2,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  formatResultDateLabel,
  GLOBAL_SEARCH_DEBOUNCE_MS,
  GLOBAL_SEARCH_FILTERS,
  GLOBAL_SEARCH_MIN_CHARS,
  groupSearchResults,
  type GlobalSearchFilter,
  type GlobalSearchGroup,
  type GlobalSearchModuleKey,
  type GlobalSearchResult,
} from "@/utils/global-search";
import { parseJsonResponse } from "@/utils/safe-json";

const MODULE_ICONS: Record<GlobalSearchModuleKey, LucideIcon> = {
  crescimento: Rocket,
  alvesz: Building2,
  calendario: CalendarDays,
  saude: Dumbbell,
  "social-media": Share2,
  financeiro: Wallet,
  "aura-central": Sparkles,
};

export function GlobalSearch() {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GlobalSearchFilter>("todos");
  const [groups, setGroups] = useState<GlobalSearchGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSearch = useCallback(async (q: string, f: GlobalSearchFilter) => {
    if (q.trim().length < GLOBAL_SEARCH_MIN_CHARS) {
      setGroups([]);
      setTotal(0);
      setError(null);
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({
        q: q.trim(),
        filter: f,
        page: "0",
      });
      const res = await fetch(`/api/aura-search?${params}`);
      const { data, error: parseError } = await parseJsonResponse<{
        groups?: GlobalSearchGroup[];
        results?: GlobalSearchResult[];
        total?: number;
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        setError(data?.error ?? parseError ?? "Erro na busca.");
        setGroups([]);
        setTotal(0);
        return;
      }

      setGroups(
        data?.groups?.length
          ? data.groups
          : groupSearchResults(data?.results ?? [])
      );
      setTotal(data?.total ?? 0);
      setError(null);
    } catch {
      setError("Falha ao buscar.");
      setGroups([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      void fetchSearch(query, filter);
    }, GLOBAL_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query, filter, open, fetchSearch]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function handleFilterChange(id: GlobalSearchFilter) {
    setFilter(id);
  }

  const showPanel = open && query.trim().length >= GLOBAL_SEARCH_MIN_CHARS;
  const resultCount = groups.reduce((n, g) => n + g.results.length, 0);
  const empty =
    !loading && !error && query.trim().length >= GLOBAL_SEARCH_MIN_CHARS && resultCount === 0;

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 md:max-w-md">
      <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Pesquisar na Aura..."
        aria-label="Pesquisar na Aura"
        aria-expanded={showPanel}
        aria-controls={listId}
        className="h-9 w-full rounded-md border border-white/[0.06] bg-white/[0.02] pl-8 pr-3 text-[12px] text-zinc-200 placeholder:text-zinc-600 transition-colors duration-200 focus:border-white/[0.12] focus:bg-white/[0.04] focus:outline-none md:h-8"
      />

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[min(70vh,480px)] overflow-hidden rounded-lg border border-white/[0.08] bg-zinc-950 shadow-xl"
        >
          <div className="flex gap-1 overflow-x-auto border-b border-white/[0.06] p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {GLOBAL_SEARCH_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => handleFilterChange(f.id)}
                className={`shrink-0 rounded-md px-2 py-1 text-[10px] transition-colors ${
                  filter === f.id
                    ? "bg-violet-500/20 text-violet-200"
                    : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="overflow-y-auto p-1">
            {loading && (
              <div className="flex items-center gap-2 px-3 py-4 text-[12px] text-zinc-500">
                <Loader2 className="size-3.5 animate-spin" />
                Buscando...
              </div>
            )}

            {error && !loading && (
              <p className="px-3 py-3 text-[12px] text-red-400/90">{error}</p>
            )}

            {empty && (
              <p className="px-3 py-4 text-center text-[12px] text-zinc-500">
                Nenhum resultado encontrado.
              </p>
            )}

            {!loading &&
              groups.map((group) => {
                const Icon = MODULE_ICONS[group.moduleKey];
                return (
                  <div key={group.moduleKey} className="mb-1">
                    <div className="flex items-center gap-1.5 px-3 py-2">
                      <Icon className="size-3.5 shrink-0 text-violet-400/90" />
                      <p className="text-[11px] font-medium text-zinc-400">
                        {group.moduleLabel}
                      </p>
                    </div>
                    <ul>
                      {group.results.map((item) => (
                        <li key={`${item.entity}-${item.id}`}>
                          <Link
                            href={item.moduleHref}
                            role="option"
                            onClick={() => setOpen(false)}
                            className="block rounded-md px-3 py-2 pl-8 transition-colors hover:bg-white/[0.04]"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-medium text-zinc-200">
                                  {item.title}
                                </p>
                                <p className="text-[10px] text-zinc-500">
                                  {item.typeLabel}
                                </p>
                              </div>
                              <span className="shrink-0 text-[10px] text-zinc-600">
                                {formatResultDateLabel(item.dateIso)}
                              </span>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

            {!loading && total > resultCount && resultCount > 0 && (
              <p className="px-3 py-2 text-center text-[10px] text-zinc-600">
                Mostrando {resultCount} de {total} resultados
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
