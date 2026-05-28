import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  TableInsert,
  TableRow,
  TableUpdate,
  UserScopedTable,
} from "@/types/database";

export type RepositoryResult<T> = {
  data: T | null;
  error: string | null;
};

type ScopedQuery = {
  select: (columns?: string) => {
    eq: (
      column: string,
      value: string
    ) => {
      order: (
        column: string,
        options?: { ascending?: boolean }
      ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
  };
  insert: (values: Record<string, unknown>) => {
    select: () => {
      single: () => Promise<{
        data: unknown;
        error: { message: string } | null;
      }>;
    };
  };
  update: (values: Record<string, unknown>) => {
    eq: (
      column: string,
      value: string
    ) => {
      eq: (
        column: string,
        value: string
      ) => {
        select: () => {
          single: () => Promise<{
            data: unknown;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
  delete: () => {
    eq: (
      column: string,
      value: string
    ) => {
      eq: (
        column: string,
        value: string
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
};

export class BaseRepository<T extends UserScopedTable> {
  constructor(
    protected readonly supabase: SupabaseClient<Database>,
    protected readonly table: T,
    protected readonly userId: string
  ) {}

  protected query(): ScopedQuery {
    return this.supabase.from(this.table) as unknown as ScopedQuery;
  }

  async findAll(orderColumn = "created_at"): Promise<RepositoryResult<TableRow<T>[]>> {
    const { data, error } = await this.query()
      .select("*")
      .eq("user_id", this.userId)
      .order(orderColumn, { ascending: false });
    return {
      data: (data as unknown as TableRow<T>[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findById(id: string): Promise<RepositoryResult<TableRow<T>>> {
    const { data, error } = await this.query()
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });
    const row = ((data as TableRow<T>[]) ?? []).find((r) => r.id === id) ?? null;
    return { data: row, error: error?.message ?? null };
  }

  async create(
    payload: Omit<TableInsert<T>, "user_id">
  ): Promise<RepositoryResult<TableRow<T>>> {
    const { data, error } = await this.query()
      .insert({ ...payload, user_id: this.userId })
      .select()
      .single();
    return {
      data: (data as unknown as TableRow<T>) ?? null,
      error: error?.message ?? null,
    };
  }

  async update(
    id: string,
    payload: TableUpdate<T>
  ): Promise<RepositoryResult<TableRow<T>>> {
    const { data, error } = await this.query()
      .update(payload as Record<string, unknown>)
      .eq("user_id", this.userId)
      .eq("id", id)
      .select()
      .single();
    return {
      data: (data as unknown as TableRow<T>) ?? null,
      error: error?.message ?? null,
    };
  }

  async delete(id: string): Promise<RepositoryResult<null>> {
    const { error } = await this.query()
      .delete()
      .eq("user_id", this.userId)
      .eq("id", id);
    return { data: null, error: error?.message ?? null };
  }
}
