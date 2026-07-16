import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  GoogleDriveConnection,
  GoogleDriveConnectionStatusValue,
} from "@/types/database";

export class GoogleDriveConnectionsRepository {
  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly userId: string
  ) {}

  async findForUser(): Promise<{ data: GoogleDriveConnection | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from("google_drive_connections")
      .select("*")
      .eq("user_id", this.userId)
      .maybeSingle();

    return {
      data: (data as GoogleDriveConnection) ?? null,
      error: error?.message ?? null,
    };
  }

  async upsert(row: {
    google_email?: string | null;
    google_display_name?: string | null;
    access_token: string;
    refresh_token: string;
    expires_at: string;
    status?: GoogleDriveConnectionStatusValue;
    last_error?: string | null;
  }): Promise<{ data: GoogleDriveConnection | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from("google_drive_connections")
      .upsert(
        {
          user_id: this.userId,
          google_email: row.google_email ?? null,
          google_display_name: row.google_display_name ?? null,
          access_token: row.access_token,
          refresh_token: row.refresh_token,
          expires_at: row.expires_at,
          status: row.status ?? "active",
          last_error: row.last_error ?? null,
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    return {
      data: (data as GoogleDriveConnection) ?? null,
      error: error?.message ?? null,
    };
  }

  async markExpired(lastError: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from("google_drive_connections")
      .update({
        status: "expired",
        last_error: lastError,
      })
      .eq("user_id", this.userId);

    return { error: error?.message ?? null };
  }

  async markActive(): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from("google_drive_connections")
      .update({
        status: "active",
        last_error: null,
      })
      .eq("user_id", this.userId);

    return { error: error?.message ?? null };
  }

  async deleteForUser(): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from("google_drive_connections")
      .delete()
      .eq("user_id", this.userId);

    return { error: error?.message ?? null };
  }
}
