"use client";

import type { Gasto } from "@/types/database";
import { useSupabaseCrud } from "./use-supabase-crud";

export function useGastos() {
  return useSupabaseCrud<"gastos">({ table: "gastos", orderBy: "data" });
}

export type { Gasto };
