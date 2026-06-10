import { BaseRepository } from "./base.repository";
import type {
  IntegrationConnection,
  IntegrationEvent,
  IntegrationSyncLog,
} from "@/types/database";

export class IntegrationConnectionsRepository extends BaseRepository<"integration_connections"> {
  constructor(supabase: ConstructorParameters<typeof BaseRepository>[0], userId: string) {
    super(supabase, "integration_connections", userId);
  }

  async findAllOrdered() {
    return this.findAll("platform");
  }

  async findByPlatform(platform: IntegrationConnection["platform"]) {
    const { data, error } = await this.supabase
      .from("integration_connections")
      .select("*")
      .eq("user_id", this.userId)
      .eq("platform", platform)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data: data as IntegrationConnection | null, error: null };
  }
}

export class IntegrationSyncLogsRepository extends BaseRepository<"integration_sync_logs"> {
  constructor(supabase: ConstructorParameters<typeof BaseRepository>[0], userId: string) {
    super(supabase, "integration_sync_logs", userId);
  }

  async findRecent(limit = 20) {
    const { data, error } = await this.supabase
      .from("integration_sync_logs")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as IntegrationSyncLog[], error: null };
  }

  async findLatest() {
    const { data, error } = await this.supabase
      .from("integration_sync_logs")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data: data as IntegrationSyncLog | null, error: null };
  }
}

export class IntegrationEventsRepository extends BaseRepository<"integration_events"> {
  constructor(supabase: ConstructorParameters<typeof BaseRepository>[0], userId: string) {
    super(supabase, "integration_events", userId);
  }

  async findRecent(limit = 30) {
    const { data, error } = await this.supabase
      .from("integration_events")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as IntegrationEvent[], error: null };
  }

  async findToday() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const { data, error } = await this.supabase
      .from("integration_events")
      .select("*")
      .eq("user_id", this.userId)
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as IntegrationEvent[], error: null };
  }
}
