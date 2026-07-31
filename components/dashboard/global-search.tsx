"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Building2,
  CalendarDays,
  Compass,
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
import { listFavoritesAction } from "@/app/actions/daily";
import {
  isCommandLikeQuery,
  listCommandSuggestions,
  parseCommandIntent,
  type CommandIntent,
} from "@/lib/orchestrator";

const MODULE_ICONS: Record<GlobalSearchModuleKey, LucideIcon> = {
  "aura-brain": Compass,
  crescimento: Rocket,
  alvesz: Building2,
  calendario: CalendarDays,
  saude: Dumbbell,
  "social-media": Share2,
  financeiro: Wallet,
  "aura-central": Sparkles,
};

export function GlobalSearch() {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GlobalSearchFilter>("todos");
  const [groups, setGroups] = useState<GlobalSearchGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinned, setPinned] = useState<
    Array<{ id: string; title: string; href: string }>
  >([]);

  const commands = useMemo(() => {
    if (!query.trim()) return listCommandSuggestions("", 6);
    if (isCommandLikeQuery(query) || query.trim().length >= 2) {
      return listCommandSuggestions(query, 6);
    }
    return [] as CommandIntent[];
  }, [query]);

  const primaryCommand = useMemo(() => {
    if (!query.trim()) return null;
    const intent = parseCommandIntent(query);
    return intent.kind !== "unknown" && intent.kind !== "search_nl"
      ? intent
      : null;
  }, [query]);

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
    void listFavoritesAction()
      .then((items) => {
        setPinned(
          items
            .filter((f) => (f.pins ?? []).includes("search"))
            .map((f) => ({ id: f.id, title: f.title, href: f.href }))
        );
      })
      .catch(() => setPinned([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (primaryCommand && query.trim().length < 24) {
      // Prefer command UX for short imperative queries; still allow search
    }
    const t = window.setTimeout(() => {
      void fetchSearch(query, filter);
    }, GLOBAL_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query, filter, open, fetchSearch, primaryCommand]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        const input = rootRef.current?.querySelector("input");
        input?.focus();
      }
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Enter" && open && primaryCommand) {
        e.preventDefault();
        setOpen(false);
        router.push(primaryCommand.href);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, primaryCommand, router]);

  function handleFilterChange(id: GlobalSearchFilter) {
    setFilter(id);
  }

  const showPanel =
    open &&
    (query.trim().length >= 1 ||
      query.trim().length >= GLOBAL_SEARCH_MIN_CHARS ||
      pinned.length > 0 ||
      commands.length > 0);
  const resultCount = groups.reduce((n, g) => n + g.results.length, 0);
  const empty =
    !loading &&
    !error &&
    query.trim().length >= GLOBAL_SEARCH_MIN_CHARS &&
    resultCount === 0 &&
    !primaryCommand;

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 md:max-w-md">
      <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Comandos ou busca… (Ctrl+K)"
        aria-label="Command Palette e busca Aura (Ctrl+K)"
        data-testid="global-search-input"
        aria-expanded={showPanel}
        aria-controls={listId}
        className="h-9 w-full rounded-md border border-white/[0.06] bg-white/[0.02] pl-8 pr-3 text-[12px] text-zinc-200 placeholder:text-zinc-600 transition-colors duration-200 focus:border-white/[0.12] focus:bg-white/[0.04] focus:outline-none md:h-8"
      />

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[min(70vh,480px)] overflow-hidden rounded-lg border border-white/[0.08] bg-zinc-950 shadow-xl"
          data-testid="command-palette-v2"
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
            {commands.length > 0 ? (
              <div className="mb-1" data-testid="command-palette-commands">
                <p className="px-3 py-2 text-[11px] font-medium text-cyan-200/80">
                  Comandos
                </p>
                <ul>
                  {commands.map((c) => (
                    <li key={`${c.kind}-${c.href}`}>
                      <button
                        type="button"
                        role="option"
                        onClick={() => {
                          setOpen(false);
                          router.push(c.href);
                        }}
                        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
                      >
                        <span className="truncate text-[13px] text-zinc-200">
                          {c.label}
                        </span>
                        <span className="text-[10px] text-zinc-600">↵</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {pinned.length > 0 && query.trim().length < GLOBAL_SEARCH_MIN_CHARS ? (
              <div className="mb-1" data-testid="search-pinned">
                <p className="px-3 py-2 text-[11px] font-medium text-amber-200/80">
                  Fixados na Busca
                </p>
                <ul>
                  {pinned.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={p.href}
                        role="option"
                        onClick={() => setOpen(false)}
                        className="block rounded-md px-3 py-2 transition-colors hover:bg-white/[0.04]"
                      >
                        <p className="truncate text-[13px] text-zinc-200">
                          {p.title}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

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
                Nenhum resultado. Tente &quot;abrir projeto&quot;, &quot;documentos
                sobre Disney&quot; ou registre uma memória.
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
