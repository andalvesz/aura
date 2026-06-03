import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Notification } from "@/types/database";
import { BaseRepository } from "./base.repository";

export class NotificationsRepository extends BaseRepository<"notifications"> {
  constructor(supabase: SupabaseClient<Database>, userId: string) {
    super(supabase, "notifications", userId);
  }

  async findAllOrdered(): Promise<{ data: Notification[] | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from("notifications")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });

    return {
      data: (data as Notification[] | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async findUnread(): Promise<{ data: Notification[] | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from("notifications")
      .select("*")
      .eq("user_id", this.userId)
      .eq("status", "unread")
      .order("scheduled_for", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    return {
      data: (data as Notification[] | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async markAsRead(id: string): Promise<{ data: Notification | null; error: string | null }> {
    const { data, error } = await this.supabase
      .from("notifications")
      .update({
        status: "read",
        read_at: new Date().toISOString(),
      })
      .eq("user_id", this.userId)
      .eq("id", id)
      .select()
      .single();

    return {
      data: (data as Notification | null) ?? null,
      error: error?.message ?? null,
    };
  }

  async markAllAsRead(): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from("notifications")
      .update({
        status: "read",
        read_at: new Date().toISOString(),
      })
      .eq("user_id", this.userId)
      .eq("status", "unread");

    return { error: error?.message ?? null };
  }
}
