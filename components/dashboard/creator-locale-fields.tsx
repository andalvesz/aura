"use client";

import type { CreatorLocale, CreatorLocalePartial } from "@/utils/creator-locale";
import {
  CREATOR_COUNTRY_OPTIONS,
  CREATOR_CURRENCY_OPTIONS,
  CREATOR_LANGUAGE_OPTIONS,
  DEFAULT_CREATOR_LOCALE,
  resolveCreatorLocale,
} from "@/utils/creator-locale";

type CreatorLocaleFieldsProps = {
  value: CreatorLocalePartial;
  onChange: (next: CreatorLocale) => void;
  className?: string;
};

export function CreatorLocaleFields({ value, onChange, className }: CreatorLocaleFieldsProps) {
  const resolved = resolveCreatorLocale(value);

  function update(partial: CreatorLocalePartial) {
    onChange(resolveCreatorLocale({ ...resolved, ...partial }));
  }

  return (
    <div className={className}>
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        Mercado de destino
      </p>
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
