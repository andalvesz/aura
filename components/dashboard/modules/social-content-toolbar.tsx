"use client";

import { Search, X } from "lucide-react";
import type { InstagramMarca } from "@/types/database";
import { INSTAGRAM_MARCAS } from "@/utils/instagram";
import { FORM_INPUT_CLASS, FORM_SELECT_CLASS } from "@/utils/dashboard-mobile";
import {
  DEFAULT_SOCIAL_FILTERS,
  SOCIAL_FILTER_OPTIONS,
  type SocialContentFilters,
} from "@/utils/social-filters";
import {
  getFormatoLabel,
  getPlataformaLabel,
} from "@/utils/social";

type SocialContentToolbarProps = {
  filters: SocialContentFilters;
  onChange: (filters: SocialContentFilters) => void;
  resultCount: number;
};

export function SocialContentToolbar({
  filters,
  onChange,
  resultCount,
}: SocialContentToolbarProps) {
  const hasActiveFilters =
    filters.marca !== DEFAULT_SOCIAL_FILTERS.marca ||
    filters.plataforma !== DEFAULT_SOCIAL_FILTERS.plataforma ||
    filters.status !== DEFAULT_SOCIAL_FILTERS.status ||
    filters.formato !== DEFAULT_SOCIAL_FILTERS.formato ||
    filters.periodo !== DEFAULT_SOCIAL_FILTERS.periodo ||
    filters.search.trim().length > 0;

  function patch(partial: Partial<SocialContentFilters>) {
    onChange({ ...filters, ...partial });
  }

  return (
    <div className="space-y-2 rounded-md border border-white/[0.06] bg-zinc-950/30 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600" />
        <input
          type="search"
          value={filters.search}
          onChange={(e) => patch({ search: e.target.value })}
          placeholder="Buscar conteúdo..."
          className={`${FORM_INPUT_CLASS} pl-9`}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <FilterSelect
          label="Marca"
          value={filters.marca}
          onChange={(v) => patch({ marca: v as InstagramMarca | "all" })}
          options={[
            { id: "all", label: "Todas" },
            ...INSTAGRAM_MARCAS.map((m) => ({ id: m.id, label: m.label })),
          ]}
        />
        <FilterSelect
          label="Plataforma"
          value={filters.plataforma}
          onChange={(v) => patch({ plataforma: v })}
          options={SOCIAL_FILTER_OPTIONS.plataformas.map((p) => ({
            id: p.id,
            label: p.id === "all" ? p.label : getPlataformaLabel(p.id),
          }))}
        />
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(v) => patch({ status: v as SocialContentFilters["status"] })}
          options={SOCIAL_FILTER_OPTIONS.statuses}
        />
        <FilterSelect
          label="Formato"
          value={filters.formato}
          onChange={(v) => patch({ formato: v })}
          options={SOCIAL_FILTER_OPTIONS.formatos.map((f) => ({
            id: f.id,
            label: f.id === "all" ? f.label : getFormatoLabel(f.id),
          }))}
        />
        <FilterSelect
          label="Período"
          value={filters.periodo}
          onChange={(v) => patch({ periodo: v as SocialContentFilters["periodo"] })}
          options={SOCIAL_FILTER_OPTIONS.periodos.map((p) => ({
            id: p.id,
            label: p.label,
          }))}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span>
          {resultCount === 1
            ? "1 conteúdo encontrado"
            : `${resultCount} conteúdos encontrados`}
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_SOCIAL_FILTERS })}
            className="inline-flex items-center gap-1 text-violet-300 hover:text-violet-200"
          >
            <X className="size-3" />
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <label className="block text-[11px] text-zinc-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FORM_SELECT_CLASS}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-zinc-900">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
