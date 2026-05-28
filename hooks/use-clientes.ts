"use client";

import { useSupabaseCrud } from "./use-supabase-crud";

export function useClientes() {
  return useSupabaseCrud<"clientes">({ table: "clientes", orderBy: "nome", ascending: true });
}
