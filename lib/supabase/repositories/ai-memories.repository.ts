import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiMemory, AiMemoryCategoria, Database } from "@/types/database";
import { BaseRepository } from "./base.repository";

export type AiMemorySearchOptions = {
  categoria?: AiMemoryCategoria | "all";
  from?: string;
  to?: string;
  q?: string;
  limit?: number;
};

export class AiMemoriesRepository extends BaseRepository<"ai_memories"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "ai_memories", userId);
  }

  async search(options: AiMemorySearchOptions = {}) {
    const limit = options.limit ?? 50;
    let query = this.supabase
      .from("ai_memories")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (options.categoria && options.categoria !== "all") {
      query = query.eq("categoria", options.categoria);
    }

    if (options.from) {
      query = query.gte("created_at", `${options.from}T00:00:00.000Z`);
    }

    if (options.to) {
      query = query.lte("created_at", `${options.to}T23:59:59.999Z`);
    }

    const { data, error } = await query;
    if (error) {
      return { data: null, error: error.message };
    }

    let rows = (data as AiMemory[]) ?? [];

    if (options.q?.trim()) {
      const term = options.q.trim().toLowerCase();
      rows = rows.filter(
        (m) =>
          m.titulo.toLowerCase().includes(term) ||
          m.conteudo.toLowerCase().includes(term) ||
          m.origem.toLowerCase().includes(term)
      );
    }

    return { data: rows, error: null };
  }

  async findOnDate(isoDate: string, limit = 20) {
    return this.search({ from: isoDate, to: isoDate, limit });
  }

  async findRecent(limit = 10, categoria?: AiMemoryCategoria) {
    return this.search({
      categoria: categoria ?? "all",
      limit,
    });
  }

  async findByKeywords(
    keywords: string[],
    options: { categoria?: AiMemoryCategoria; limit?: number } = {}
  ) {
    const { data, error } = await this.search({
      categoria: options.categoria,
      limit: options.limit ?? 30,
    });

    if (error || !data) {
      return { data: null, error };
    }

    const lower = keywords.map((k) => k.toLowerCase());
    const filtered = data.filter((m) => {
      const blob = `${m.titulo} ${m.conteudo}`.toLowerCase();
      return lower.some((k) => blob.includes(k));
    });

    return { data: filtered, error: null };
  }

  async append(
    categoria: AiMemoryCategoria,
    titulo: string,
    conteudo: string,
    origem: string
  ) {
    return this.create({
      categoria,
      titulo: titulo.trim().slice(0, 200),
      conteudo: conteudo.trim(),
      origem,
    } as Omit<import("@/types/database").TableInsert<"ai_memories">, "user_id">);
  }
}
