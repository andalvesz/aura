"use client";

import type { CreatorLocale, CreatorLocalePartial } from "@/utils/creator-locale";
import {
  CREATOR_COUNTRY_OPTIONS,
  CREATOR_CURRENCY_OPTIONS,
  CREATOR_LANGUAGE_OPTIONS,
  CREATOR_LOCALE_PRESETS,
  DEFAULT_CREATOR_LOCALE,
  formatLocaleLabel,
  resolveCreatorLocale,
} from "@/utils/creator-locale";
import { cn } from "@/utils/cn";

type CreatorLocaleFieldsProps = {
  value: CreatorLocalePartial;
  onChange: (next: CreatorLocale) => void;
  className?: string;
  showPresets?: boolean;
};

export function CreatorLocaleFields({
  value,
  onChange,
  className,
  showPresets = true,
}: CreatorLocaleFieldsProps) {
  const resolved = resolveCreatorLocale(value);

  function update(partial: CreatorLocalePartial) {
    onChange(resolveCreatorLocale({ ...resolved, ...partial }));
  }

  return (
    <div className={className}>
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        Mercado de destino
      </p>
      {showPresets && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {CREATOR_LOCALE_PRESETS.map((preset) => (
            <button
              key={formatLocaleLabel(preset)}
              type="button"
              onClick={() => onChange(preset)}
              className={cn(
                "rounded-md border px-2 py-1 text-[10px] transition-colors",
                resolved.target_country === preset.target_country &&
                  resolved.target_language === preset.target_language &&
                  resolved.currency === preset.currency
                  ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
                  : "border-white/[0.06] text-zinc-500 hover:border-white/10 hover:text-zinc-300"
              )}
            >
              {formatLocaleLabel(preset)}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-[10px] text-zinc-500">País de destino *</span>
          <select
            value={resolved.target_country}
            onChange={(e) => update({ target_country: e.target.value as CreatorLocale["target_country"] })}
            className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-violet-500/40"
          >
            {CREATOR_COUNTRY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] text-zinc-500">Idioma do produto *</span>
          <select
            value={resolved.target_language}
            onChange={(e) =>
              update({ target_language: e.target.value as CreatorLocale["target_language"] })
            }
            className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-violet-500/40"
          >
            {CREATOR_LANGUAGE_OPTIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] text-zinc-500">Moeda principal *</span>
          <select
            value={resolved.currency}
            onChange={(e) => update({ currency: e.target.value as CreatorLocale["currency"] })}
            className="w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-[12px] text-zinc-100 outline-none focus:border-violet-500/40"
          >
            {CREATOR_CURRENCY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

export { DEFAULT_CREATOR_LOCALE };
