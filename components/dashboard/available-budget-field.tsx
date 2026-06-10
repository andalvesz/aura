"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { BudgetScope } from "@/lib/supabase/services/campaign-budget.service";
import { useAvailableBudget } from "@/hooks/use-available-budget";
import { parseBudgetInput } from "@/utils/campaign-budget";
import { cn } from "@/utils/cn";

type AvailableBudgetFieldProps = {
  scope?: BudgetScope;
  entityId?: string | null;
  value?: number | null;
  onChange?: (value: number | null) => void;
  onSaved?: (value: number) => void;
  className?: string;
  showHint?: boolean;
  persistOnBlur?: boolean;
};

export function AvailableBudgetField({
  scope,
  entityId,
  value,
  onChange,
  onSaved,
  className,
  showHint = true,
  persistOnBlur = false,
}: AvailableBudgetFieldProps) {
  const { budget, hint, busy, saveBudget, formatted } = useAvailableBudget(scope, entityId);
  const resolved = value ?? budget.orcamento;
  const [input, setInput] = useState("");

  useEffect(() => {
    if (resolved != null && resolved > 0) {
      setInput(String(Math.round(resolved)));
    } else if (formatted) {
      setInput(String(Math.round(budget.orcamento ?? 0)));
    }
  }, [resolved, formatted, budget.orcamento]);

  async function commit(nextRaw: string) {
    const parsed = parseBudgetInput(nextRaw);
    onChange?.(parsed);
    if (persistOnBlur && parsed != null) {
      const { error } = await saveBudget(parsed);
      if (!error) onSaved?.(parsed);
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-zinc-400">
          Orçamento disponível
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Ex: 300, 1000, 5000"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              onChange?.(parseBudgetInput(e.target.value));
            }}
            onBlur={() => void commit(input)}
            className="w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-zinc-200 placeholder:text-zinc-600"
          />
          {persistOnBlur && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void commit(input)}
              className="shrink-0 rounded-md border border-white/[0.08] px-3 py-2 text-[11px] text-zinc-300 hover:bg-white/[0.04] disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Salvar"}
            </button>
          )}
        </div>
      </label>
      {showHint && (
        <p className="text-[10px] text-zinc-600">
          {resolved != null && resolved > 0 ? hint : "Informe quanto pode investir antes da IA sugerir campanhas."}
        </p>
      )}
    </div>
  );
}
