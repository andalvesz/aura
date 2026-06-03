import type { GoogleCalendarConnection } from "@/types/database";
import { getDataContext, getOptionalDataContext } from "@/lib/supabase/services/context";
import type { GoogleCalendarPublicStatus } from "@/utils/google-calendar";
import { getGoogleOAuthConfig } from "./config";
import {
  fetchGoogleUserEmail,
  refreshGoogleAccessToken,
  tokenExpiresAt,
} from "./oauth";

export type { GoogleCalendarPublicStatus };

export async function getGoogleCalendarPublicStatus(): Promise<GoogleCalendarPublicStatus> {
  const configured = Boolean(getGoogleOAuthConfig());
  const ctx = await getOptionalDataContext();

  if (!ctx) {
    return { connected: false, configured, email: null, calendarId: null };
  }

  const { data } = await ctx.supabase
    .from("google_calendar_connections")
    .select("google_email, calendar_id")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!data) {
    return { connected: false, configured, email: null, calendarId: null };
  }

  return {
    connected: true,
    configured,
    email: data.google_email,
    calendarId: data.calendar_id,
  };
}

export async function getGoogleCalendarConnection(): Promise<{
  connection: GoogleCalendarConnection | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { connection: null, error: "Usuário não autenticado." };
  }

  const { data, error } = await ctx.supabase
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (error) {
    return { connection: null, error: error.message };
  }

  return { connection: (data as GoogleCalendarConnection) ?? null, error: null };
}

export async function saveGoogleCalendarConnection(params: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  email?: string | null;
}) {
  const { supabase, userId } = await getDataContext();
  const email =
    params.email ?? (await fetchGoogleUserEmail(params.accessToken));

  const { connection: existing } = await getGoogleCalendarConnection();

  const row = {
    user_id: userId,
    access_token: params.accessToken,
    refresh_token: params.refreshToken,
    token_expires_at: tokenExpiresAt(params.expiresIn),
    google_email: email,
    calendar_id: existing?.calendar_id ?? "primary",
    gmail_enabled: existing?.gmail_enabled ?? false,
  };

  const { error } = await supabase.from("google_calendar_connections").upsert(row, {
    onConflict: "user_id",
  });

  return { error: error?.message ?? null };
}

export async function deleteGoogleCalendarConnection() {
  const { supabase, userId } = await getDataContext();
  const { error } = await supabase
    .from("google_calendar_connections")
    .delete()
    .eq("user_id", userId);

  return { error: error?.message ?? null };
}

export async function getValidGoogleAccessToken(): Promise<{
  accessToken: string | null;
  calendarId: string | null;
  error: string | null;
}> {
  const oauth = getGoogleOAuthConfig();
  if (!oauth) {
    return { accessToken: null, calendarId: null, error: "Google Calendar não configurado." };
  }

  const { connection, error } = await getGoogleCalendarConnection();
  if (error || !connection) {
    return { accessToken: null, calendarId: null, error: error ?? null };
  }

  const expiresAt = new Date(connection.token_expires_at).getTime();
  const needsRefresh = expiresAt - Date.now() < 60_000;

  if (!needsRefresh) {
    return {
      accessToken: connection.access_token,
      calendarId: connection.calendar_id,
      error: null,
    };
  }

  try {
    const refreshed = await refreshGoogleAccessToken(
      connection.refresh_token,
      oauth.clientId,
      oauth.clientSecret
    );

    const { supabase, userId } = await getDataContext();
    const { error: updateError } = await supabase
      .from("google_calendar_connections")
      .update({
        access_token: refreshed.access_token,
        token_expires_at: tokenExpiresAt(refreshed.expires_in),
        ...(refreshed.refresh_token
          ? { refresh_token: refreshed.refresh_token }
          : {}),
      })
      .eq("user_id", userId);

    if (updateError) {
      return { accessToken: null, calendarId: null, error: updateError.message };
    }

    return {
      accessToken: refreshed.access_token,
      calendarId: connection.calendar_id,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao renovar token Google.";
    return { accessToken: null, calendarId: null, error: message };
  }
}

export async function updateGoogleSyncToken(syncToken: string | null) {
  const { supabase, userId } = await getDataContext();
  await supabase
    .from("google_calendar_connections")
    .update({ sync_token: syncToken })
    .eq("user_id", userId);
}
