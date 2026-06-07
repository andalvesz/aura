"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Loader2, Search } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import type { AiMemory, AiMemoryCategoria } from "@/types/database";
import {
  AI_MEMORY_CATEGORIAS,
  AI_MEMORY_CATEGORY_LABELS,
  formatAuraMemoryDate,
} from "@/utils/aura-memory";
import { parseJsonResponse } from "@/utils/safe-json";

export function MemoriaView() {
  const [memories, setMemories] = useState<AiMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoria, setCategoria] = useState<AiMemoryCategoria | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  const loadMemories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (categoria !== "all") params.set("categoria", categoria);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (q.trim()) params.set("q", q.trim());

      const res = await fetch(`/api/memory?${params}`);
      const { data, error: parseError } = await parseJsonResponse<{
        memories?: AiMemory[];
        error?: string;
      }>(res);

      if (parseError || !res.ok) {
        setError(data?.error ?? parseError ?? "Erro ao carregar memórias.");
        setMemories([]);
        return;
      }

      setMemories(data?.memories ?? []);
    } catch {
      setError("Falha ao carregar memórias.");
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, [categoria, from, to, q]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadMemories();
    }, 300);
    return () => window.clearTimeout(t);
  }, [loadMemories]);

  return (
    <div className="space-y-3">
      <Panel className="border-violet-500/10 bg-violet-500/[0.02]">
        <PanelHeader>
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-violet-400" />
            <PanelTitle>Memória da Aura</PanelTitle>
          </div>
        </PanelHeader>
        <PanelContent className="space-y-3 pt-0">
          <p className="text-[12px] text-zinc-500">
            Recomendações, planos, treinos e estratégias que a Aura registrou automaticamente.
          </p>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-[11px] text-zinc-500">
              Categoria
              <select
                value={categoria}
                onChange={(e) =>
                  setCategoria(e.target.value as AiMemoryCategoria | "all")
                }
                className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 md:min-h-9 md:h-9 md:text-[13px]"
              >
                <option value="all" className="bg-zinc-900">
                  Todas
                </option>
                {AI_MEMORY_CATEGORIAS.map((c) => (
                  <option key={c.id} value={c.id} className="bg-zinc-900">
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[11px] text-zinc-500">
              De
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 md:min-h-9 md:h-9 md:text-[13px]"
              />
            </label>

            <label className="block text-[11px] text-zinc-500">
              Até
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 md:min-h-9 md:h-9 md:text-[13px]"
              />
            </label>

            <label className="block text-[11px] text-zinc-500">
              Busca
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600" />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Treino, lead, casamento..."
                  className="min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] py-2 pl-8 pr-3 text-base text-zinc-200 placeholder:text-zinc-600 md:min-h-9 md:h-9 md:text-[13px]"
                />
              </div>
            </label>
          </div>
        </PanelContent>
      </Panel>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <p className="text-[13px] text-red-400/90">{error}</p>
      ) : memories.length === 0 ? (
        <EmptyState
          title="Nenhuma memória ainda"
          description="Converse com a Aura Coach, Mentor ou módulos de IA. Recomendações importantes serão salvas aqui."
        />
      ) : (
        <ul className="space-y-2">
          {memories.map((memory) => (
            <li key={memory.id}>
              <Panel>
                <PanelContent className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-violet-400/90">
                        {AI_MEMORY_CATEGORY_LABELS[memory.categoria]}
                      </p>
                      <p className="mt-0.5 text-[14px] font-medium text-zinc-100">
                        {memory.titulo}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-zinc-600">
                      {formatAuraMemoryDate(memory.created_at)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-400">
                    {memory.conteudo}
                  </p>
                  <p className="mt-2 text-[10px] text-zinc-600">Origem: {memory.origem}</p>
                </PanelContent>
              </Panel>
            </li>
          ))}
        </ul>
      )}

      {!loading && memories.length > 0 && (
        <p className="text-center text-[11px] text-zinc-600">
          {memories.length} registro(s) na memória
        </p>
      )}
    </div>
  );
}
