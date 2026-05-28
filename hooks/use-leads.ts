"use client";

import { useSupabaseCrud } from "./use-supabase-crud";

export function useLeads() {
  return useSupabaseCrud<"leads">({ table: "leads" });
}
