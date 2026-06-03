"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import {
  formatResultDateLabel,
  GLOBAL_SEARCH_FILTERS,
  GLOBAL_SEARCH_MIN_CHARS,
  type GlobalSearchFilter,
  type GlobalSearchResult,
} from "@/utils/global-search";
import { parseJsonResponse } from "@/utils/safe-json";

export function GlobalSearch() {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GlobalSearchFilter>("todos");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSearch = useCallback(
    async (q: string, f: GlobalSearchFilter, pageIndex: number, append: boolean) => {
      if (q.trim().length < GLOBAL_SEARCH_MIN_CHARS) {
        setResults([]);
        setTotal(0);
        setHasMore(false);
        setError(null);
        return;
      }

      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({
          q: q.trim(),
          filter: f,
          page: String(pageIndex),
        });
        const res = await fetch(`/api/aura-search?${params}`);
        const { data, error: parseError } = await parseJsonResponse<{
          results?: GlobalSearchResult[];
          total?: number;
          hasMore?: boolean;
          error?: string;
        }>(res);

        if (parseError || !res.ok) {
          setError(data?.error ?? parseError ?? "Erro na busca.");
          if (!append) {
            setResults([]);
            setTotal(0);
            setHasMore(false);
          }
          return;
        }

        const next = data?.results ?? [];
        setResults((prev) => (append ? [...prev, ...next] : next));
        setTotal(data?.total ?? 0);
        setHasMore(Boolean(data?.hasMore));
        setError(null);
      } catch {
        setError("Falha ao buscar.");
        if (!append) {
          setResults([]);
          setTotal(0);
          setHasMore(false);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      setPage(0);
      void fetchSearch(query, filter, 0, false);
    }, 280);
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

  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    void fetchSearch(query, filter, nextPage, true);
  }

  function handleFilterChange(id: GlobalSearchFilter) {
    setFilter(id);
    setPage(0);
  }

  const showPanel = open && query.trim().length >= GLOBAL_SEARCH_MIN_CHARS;
  const empty =
    !loading && !error && query.trim().length >= GLOBAL_SEARCH_MIN_CHARS && results.length === 0;

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
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[min(70vh,420px)] overflow-hidden rounded-lg border border-white/[0.08] bg-zinc-950 shadow-xl"
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
              results.map((item) => (
                <Link
                  key={`${item.entity}-${item.id}`}
                  href={item.moduleHref}
                  role="option"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2 transition-colors hover:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-violet-400/90">
                        [{item.typeLabel}]
                      </p>
                      <p className="truncate text-[13px] font-medium text-zinc-200">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-zinc-500">{item.moduleLabel}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-zinc-600">
                      {formatResultDateLabel(item.dateIso)}
                    </span>
                  </div>
                </Link>
              ))}

            {hasMore && !loading && (
              <button
                type="button"
                disabled={loadingMore}
                onClick={handleLoadMore}
                className="mx-2 mb-2 mt-1 w-[calc(100%-1rem)] rounded-md border border-white/[0.06] py-2 text-[11px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-200 disabled:opacity-50"
              >
                {loadingMore ? "Carregando..." : `Carregar mais (${results.length}/${total})`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
