"use client";

import { useSupabaseCrud } from "./use-supabase-crud";

export function useLanguageLessons() {
  return useSupabaseCrud<"language_lessons">({
    table: "language_lessons",
    orderBy: "created_at",
    ascending: false,
  });
}
