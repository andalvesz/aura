"use client";

import type { FinancialGoal } from "@/types/database";
import { useSupabaseCrud } from "./use-supabase-crud";

export function useFinancialGoals() {
  return useSupabaseCrud<"financial_goals">({
    table: "financial_goals",
    orderBy: "data_fim",
  });
}

export type { FinancialGoal };
