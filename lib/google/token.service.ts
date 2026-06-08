import type { GoogleCalendarConnection } from "@/types/database";
import { resolveGoogleCapabilities } from "@/lib/gmail/scopes";
import { getDataContext, getOptionalDataContext } from "@/lib/supabase/services/context";
import { getGoogleOAuthConfig } from "@/lib/google-calendar/config";
import { refreshGoogleAccessToken, tokenExpiresAt } from "@/lib/google-calendar/oauth";

export async function getGoogleAccountConnection(): Promise<{
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

export async function getValidGoogleAccessToken(): Promise<{
  accessToken: string | null;
  error: string | null;
  gmailEnabled: boolean;
}> {
  const oauth = getGoogleOAuthConfig();
  if (!oauth) {
    return { accessToken: null, error: "Google não configurado no servidor.", gmailEnabled: false };
  }

  const { connection, error } = await getGoogleAccountConnection();
  if (error || !connection) {
    return { accessToken: null, error: error ?? null, gmailEnabled: false };
  }

  const expiresAt = connection.expires_at
    ? new Date(connection.expires_at).getTime()
    : 0;
  const needsRefresh = !connection.expires_at || expiresAt - Date.now() < 60_000;

  const capabilities = resolveGoogleCapabilities(connection.granted_scopes);

  if (!needsRefresh) {
    return {
      accessToken: connection.access_token,
      error: null,
      gmailEnabled: capabilities.gmailEnabled,
    };
  }

  if (!connection.refresh_token) {
    return { accessToken: null, error: "Refresh token ausente.", gmailEnabled: false };
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
        expires_at: tokenExpiresAt(refreshed.expires_in),
        ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
      })
      .eq("user_id", userId);

    if (updateError) {
      return { accessToken: null, error: updateError.message, gmailEnabled: false };
    }

    const { connection: updated } = await getGoogleAccountConnection();
    const refreshedCapabilities = resolveGoogleCapabilities(updated?.granted_scopes);

    return {
      accessToken: refreshed.access_token,
      error: null,
      gmailEnabled: refreshedCapabilities.gmailEnabled,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao renovar token Google.";
    return { accessToken: null, error: message, gmailEnabled: false };
  }
}
