"use client";

import type { FinancialIncome } from "@/types/database";
import { useSupabaseCrud } from "./use-supabase-crud";

export function useFinancialIncome() {
  return useSupabaseCrud<"financial_income">({
    table: "financial_income",
    orderBy: "data",
  });
}

export type { FinancialIncome };
