import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  TableInsert,
  TableRow,
  TableUpdate,
  WorkspaceScopedTable,
} from "@/types/database";

export type WorkspaceRepositoryResult<T> = {
  data: T | null;
  error: string | null;
};

type ScopedQuery = {
  select: (columns?: string) => {
    eq: (
      column: string,
      value: string
    ) => {
      eq: (
        column: string,
        value: string
      ) => {
        maybeSingle: () => Promise<{
          data: unknown;
          error: { message: string } | null;
        }>;
        order: (
          column: string,
          options?: { ascending?: boolean }
        ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
      order: (
        column: string,
        options?: { ascending?: boolean }
      ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      single: () => Promise<{
        data: unknown;
        error: { message: string } | null;
      }>;
      select: () => {
        single: () => Promise<{
          data: unknown;
          error: { message: string } | null;
        }>;
      };
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

/**
 * Repository for Alvesz / workspace-scoped tables.
 * Filters by workspace_id (membership enforced by RLS).
 */
export class WorkspaceScopedRepository<T extends WorkspaceScopedTable> {
  constructor(
    protected readonly supabase: SupabaseClient<Database>,
    protected readonly table: T,
    protected readonly userId: string,
    protected readonly workspaceId: string
  ) {}

  protected query(): ScopedQuery {
    return this.supabase.from(this.table) as unknown as ScopedQuery;
  }

  async findAll(orderColumn = "created_at"): Promise<WorkspaceRepositoryResult<TableRow<T>[]>> {
    const { data, error } = await this.query()
      .select("*")
      .eq("workspace_id", this.workspaceId)
      .order(orderColumn, { ascending: false });
    return {
      data: (data as unknown as TableRow<T>[]) ?? null,
      error: error?.message ?? null,
    };
  }

  async findById(id: string): Promise<WorkspaceRepositoryResult<TableRow<T>>> {
    const { data, error } = await this.query()
      .select("*")
      .eq("workspace_id", this.workspaceId)
      .eq("id", id)
      .maybeSingle();
    return {
      data: (data as unknown as TableRow<T>) ?? null,
      error: error?.message ?? null,
    };
  }

  async create(
    payload: Omit<TableInsert<T>, "user_id" | "workspace_id">
  ): Promise<WorkspaceRepositoryResult<TableRow<T>>> {
    const { data, error } = await this.query()
      .insert({
        ...(payload as Record<string, unknown>),
        user_id: this.userId,
        workspace_id: this.workspaceId,
      })
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
  ): Promise<WorkspaceRepositoryResult<TableRow<T>>> {
    const { data, error } = await this.query()
      .update(payload as Record<string, unknown>)
      .eq("workspace_id", this.workspaceId)
      .eq("id", id)
      .select()
      .single();
    return {
      data: (data as unknown as TableRow<T>) ?? null,
      error: error?.message ?? null,
    };
  }

  async delete(id: string): Promise<WorkspaceRepositoryResult<null>> {
    const { error } = await this.query()
      .delete()
      .eq("workspace_id", this.workspaceId)
      .eq("id", id);
    return { data: null, error: error?.message ?? null };
  }
}
