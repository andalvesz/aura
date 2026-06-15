import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  OperationCenter,
  OperationCenterStatus,
  TableInsert,
  TableUpdate,
} from "@/types/database";
import { BaseRepository } from "./base.repository";

const ACTIVE_STATUSES: OperationCenterStatus[] = ["draft", "preparing", "ready", "approved"];

export const CEO_SESSION_SCHEMA_CACHE_FALLBACK_LOG =
  "ceo_session_id indisponível no schema cache, operação salva sem vínculo CEO.";

function isCeoSessionIdSchemaCacheError(message: string | null | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("ceo_session_id") && lower.includes("schema cache");
}

function withCeoSessionMetadata<T extends { metadata?: unknown; ceo_session_id?: string | null }>(
  payload: T
): T {
  const ceoSessionId = payload.ceo_session_id;
  if (!ceoSessionId) return payload;

  const metadata =
    payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
      ? (payload.metadata as Record<string, unknown>)
      : {};

  return {
    ...payload,
    metadata: {
      ...metadata,
      ceo_session_id: ceoSessionId,
    },
  };
}

function withoutCeoSessionColumn<T extends { ceo_session_id?: string | null }>(
  payload: T
): Omit<T, "ceo_session_id"> {
  const { ceo_session_id: _ceoSessionId, ...rest } = payload;
  return rest;
}

export class OperationCenterRepository extends BaseRepository<"operation_center"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "operation_center", userId);
  }

  async findActive(): Promise<{ data: OperationCenter | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from("operation_center")
      .select("*")
      .eq("user_id", this.userId)
      .in("status", ACTIVE_STATUSES)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("[operation-center] findActive query failed:", error.message);
    }

    return {
      data: (data as OperationCenter | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async cancelActive() {
    const { error } = await this.supabase
      .from("operation_center")
      .update({ status: "cancelled" })
      .eq("user_id", this.userId)
      .in("status", ["draft", "preparing"]);

    return { error: error?.message ?? null };
  }

  async tryLinkCeoSession(
    operationId: string,
    ceoSessionId: string
  ): Promise<{ linked: boolean; error: string | null }> {
    const first = await super.update(operationId, {
      ceo_session_id: ceoSessionId,
    });

    if (!first.error) {
      return { linked: true, error: null };
    }

    if (isCeoSessionIdSchemaCacheError(first.error)) {
      console.warn(CEO_SESSION_SCHEMA_CACHE_FALLBACK_LOG, { operationId, ceoSessionId });
      return { linked: false, error: null };
    }

    return { linked: false, error: first.error ?? "Erro ao vincular sessão CEO." };
  }

  override async create(
    payload: Omit<TableInsert<"operation_center">, "user_id">
  ) {
    const withoutColumn = withoutCeoSessionColumn(withCeoSessionMetadata(payload));
    return super.create(
      withoutColumn as Omit<TableInsert<"operation_center">, "user_id">
    );
  }

  override async update(id: string, payload: TableUpdate<"operation_center">) {
    if (payload.ceo_session_id == null) {
      return super.update(id, withCeoSessionMetadata(payload));
    }

    const enriched = withCeoSessionMetadata(payload);
    const first = await super.update(id, enriched);
    if (!first.error || !isCeoSessionIdSchemaCacheError(first.error)) {
      return first;
    }

    console.warn(CEO_SESSION_SCHEMA_CACHE_FALLBACK_LOG, {
      operationId: id,
      ceoSessionId: enriched.ceo_session_id,
    });

    return super.update(
      id,
      withoutCeoSessionColumn(enriched) as TableUpdate<"operation_center">
    );
  }
}
