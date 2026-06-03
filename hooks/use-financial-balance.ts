"use client";

import type { FinancialBalance } from "@/types/database";
import { useSupabaseCrud } from "./use-supabase-crud";

export function useFinancialBalance() {
  return useSupabaseCrud<"financial_balance">({
    table: "financial_balance",
    orderBy: "updated_at",
  });
}

export type { FinancialBalance };
