import { gmailGetThread, gmailListMessages } from "@/lib/gmail/api";
import { getValidGoogleAccessToken } from "@/lib/google/token.service";
import type { GmailMessageSummary } from "@/utils/comms";

export type GmailPublicStatus = {
  connected: boolean;
  configured: boolean;
  email: string | null;
};

export async function getGmailPublicStatus(): Promise<GmailPublicStatus> {
  const { getGoogleOAuthConfig } = await import("@/lib/google-calendar/config");
  const { getGoogleAccountConnection } = await import("@/lib/google/token.service");

  const configured = Boolean(getGoogleOAuthConfig());
  const { connection } = await getGoogleAccountConnection();

  return {
    connected: Boolean(connection?.gmail_enabled),
    configured,
    email: connection?.google_email ?? null,
  };
}

export async function fetchRecentGmailMessages(): Promise<{
  messages: GmailMessageSummary[];
  error: string | null;
}> {
  const { accessToken, error, gmailEnabled } = await getValidGoogleAccessToken();

  if (error || !accessToken) {
    return { messages: [], error: error ?? "Conecte o Gmail." };
  }
  if (!gmailEnabled) {
    return { messages: [], error: "Reconecte o Google com permissão de Gmail." };
  }

  try {
    const messages = await gmailListMessages(accessToken, { maxResults: 15 });
    return { messages, error: null };
  } catch (err) {
    return {
      messages: [],
      error: err instanceof Error ? err.message : "Erro ao listar e-mails.",
    };
  }
}

export async function searchGmailByCliente(params: {
  email?: string | null;
  nome?: string;
}): Promise<{ messages: GmailMessageSummary[]; error: string | null }> {
  const { accessToken, error, gmailEnabled } = await getValidGoogleAccessToken();

  if (error || !accessToken || !gmailEnabled) {
    return { messages: [], error: error ?? "Gmail não conectado." };
  }

  const parts: string[] = [];
  if (params.email?.trim()) {
    parts.push(`from:${params.email.trim()} OR to:${params.email.trim()}`);
  }
  if (params.nome?.trim()) {
    parts.push(`"${params.nome.trim()}"`);
  }

  const q = parts.join(" ") || "in:inbox newer_than:30d";

  try {
    const messages = await gmailListMessages(accessToken, {
      maxResults: 20,
      q,
      labelIds: [],
    });
    return { messages, error: null };
  } catch (err) {
    return {
      messages: [],
      error: err instanceof Error ? err.message : "Erro na busca.",
    };
  }
}

export async function openGmailThread(threadId: string) {
  const { accessToken, error, gmailEnabled } = await getValidGoogleAccessToken();

  if (error || !accessToken || !gmailEnabled) {
    return { messages: [], bodyText: "", error: error ?? "Gmail não conectado." };
  }

  try {
    const { messages, bodyText } = await gmailGetThread(accessToken, threadId);
    return { messages, bodyText, error: null };
  } catch (err) {
    return {
      messages: [],
      bodyText: "",
      error: err instanceof Error ? err.message : "Erro ao abrir conversa.",
    };
  }
}

export async function countRecentInboundHint(): Promise<number> {
  const { messages } = await fetchRecentGmailMessages();
  return messages.filter((m) => !m.from.includes("@and.") && !m.from.includes("anderson")).length;
}
