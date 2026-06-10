"use client";

import { useCallback, useEffect, useState } from "react";
import type { BudgetScope } from "@/lib/supabase/services/campaign-budget.service";
import { formatBudgetHint, parseBudgetInput, type ResolvedUserBudget } from "@/utils/campaign-budget";
import { formatBRL } from "@/utils/format";
import { parseJsonResponse } from "@/utils/safe-json";

export function useAvailableBudget(scope?: BudgetScope, entityId?: string | null) {
  const [budget, setBudget] = useState<ResolvedUserBudget>({
    orcamento: null,
    source: null,
    sourceId: null,
  });
  const [sourceLabel, setSourceLabel] = useState("—");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/creator/budget");
      const { data, error: parseError } = await parseJsonResponse<{
        budget?: ResolvedUserBudget;
        sourceLabel?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        setBudget({ orcamento: null, source: null, sourceId: null });
        setSourceLabel("—");
        return;
      }

      setBudget(data.budget ?? { orcamento: null, source: null, sourceId: null });
      setSourceLabel(data.sourceLabel ?? "—");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveBudget(value: string | number) {
    const orcamento = parseBudgetInput(value);
    if (orcamento == null) {
      return { error: "Informe um orçamento válido." };
    }

    setBusy(true);
    try {
      const res = await fetch("/api/creator/budget", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orcamento_disponivel: orcamento,
          scope,
          entity_id: entityId ?? undefined,
        }),
      });
      const { data, error: parseError } = await parseJsonResponse<{
        budget?: ResolvedUserBudget;
        sourceLabel?: string;
        error?: string;
      }>(res);

      if (parseError || !res.ok || !data || data.error) {
        return { error: data?.error ?? parseError ?? "Erro ao salvar orçamento." };
      }

      setBudget(data.budget ?? { orcamento, source: scope ?? null, sourceId: entityId ?? null });
      setSourceLabel(data.sourceLabel ?? "—");
      return { error: null };
    } catch {
      return { error: "Erro de conexão." };
    } finally {
      setBusy(false);
    }
  }

  return {
    budget,
    sourceLabel,
    loading,
    busy,
    refresh,
    saveBudget,
    hint: formatBudgetHint(budget.orcamento),
    formatted: budget.orcamento != null ? formatBRL(budget.orcamento) : "",
  };
}
