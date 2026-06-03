/** Classes compartilhadas para UX mobile (touch targets ≥ 44px no mobile). */

export const FORM_INPUT_CLASS =
  "mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 placeholder:text-zinc-600 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]";

export const FORM_SELECT_CLASS = FORM_INPUT_CLASS;

export const FORM_SUBMIT_CLASS =
  "flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-base font-medium text-zinc-100 transition-colors hover:bg-white/[0.1] disabled:opacity-50 md:min-h-9 md:h-9 md:text-[13px]";

export const ICON_BTN_CLASS =
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300 md:min-h-0 md:min-w-0 md:p-1";

export const ICON_BTN_DANGER_CLASS =
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400 md:min-h-0 md:min-w-0 md:p-1";

export const CHAT_INPUT_CLASS =
  "min-h-11 flex-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 text-base text-zinc-200 placeholder:text-zinc-600 focus:border-white/[0.12] focus:outline-none disabled:opacity-50 md:h-9 md:min-h-9 md:px-2.5 md:text-[12px]";

export const CHAT_SEND_CLASS =
  "flex size-11 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] text-zinc-300 transition-colors hover:bg-white/[0.06] disabled:opacity-50 md:size-9";

export const METRICS_GRID_CLASS = "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4";

export const METRICS_GRID_WIDE_CLASS =
  "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5";
