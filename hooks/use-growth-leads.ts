"use client";

import { useSupabaseCrud } from "./use-supabase-crud";

export function useGrowthLeads() {
  return useSupabaseCrud<"growth_leads">({
    table: "growth_leads",
    orderBy: "created_at",
  });
}
