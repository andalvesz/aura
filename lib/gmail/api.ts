import type { GmailMessageSummary } from "@/utils/comms";

type GmailHeader = { name: string; value: string };

type GmailMessageRef = {
  id: string;
  threadId: string;
};

type GmailMessage = GmailMessageRef & {
  snippet?: string;
  labelIds?: string[];
  payload?: {
    headers?: GmailHeader[];
    body?: { data?: string };
    parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>;
  };
};

function getHeader(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Buffer.from(normalized, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

export function parseGmailMessage(msg: GmailMessage): GmailMessageSummary {
  const headers = msg.payload?.headers ?? [];
  const dateRaw = getHeader(headers, "Date");
  let date = new Date().toISOString();
  try {
    if (dateRaw) date = new Date(dateRaw).toISOString();
  } catch {
    /* keep default */
  }

  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: getHeader(headers, "Subject") || "(Sem assunto)",
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    snippet: msg.snippet ?? "",
    date,
    isUnread: msg.labelIds?.includes("UNREAD") ?? false,
  };
}

export async function gmailListMessages(
  accessToken: string,
  options: { maxResults?: number; q?: string; labelIds?: string[] } = {}
): Promise<GmailMessageSummary[]> {
  const params = new URLSearchParams({
    maxResults: String(options.maxResults ?? 20),
  });
  if (options.q) params.set("q", options.q);
  for (const label of options.labelIds ?? ["INBOX"]) {
    params.append("labelIds", label);
  }

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    throw new Error(await listRes.text());
  }

  const list = (await listRes.json()) as { messages?: GmailMessageRef[] };
  if (!list.messages?.length) return [];

  const summaries: GmailMessageSummary[] = [];

  for (const ref of list.messages.slice(0, options.maxResults ?? 20)) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!msgRes.ok) continue;
    const msg = (await msgRes.json()) as GmailMessage;
    summaries.push(parseGmailMessage(msg));
  }

  return summaries;
}

export async function gmailGetThread(
  accessToken: string,
  threadId: string
): Promise<{ messages: GmailMessageSummary[]; bodyText: string }> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const thread = (await res.json()) as { messages?: GmailMessage[] };
  const messages = (thread.messages ?? []).map(parseGmailMessage);

  let bodyText = "";
  const last = thread.messages?.[thread.messages.length - 1];
  if (last?.payload?.parts) {
    const textPart = last.payload.parts.find((p) => p.mimeType === "text/plain");
    if (textPart?.body?.data) bodyText = decodeBase64Url(textPart.body.data);
  } else if (last?.payload?.body?.data) {
    bodyText = decodeBase64Url(last.payload.body.data);
  }

  return { messages, bodyText: bodyText.slice(0, 8000) };
}

function toBase64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function buildMimeWithPdf(params: {
  from: string;
  to: string;
  subject: string;
  bodyText: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
  trackingPixelUrl?: string;
}): string {
  const boundary = `aura_${Date.now()}`;
  const htmlBody = params.trackingPixelUrl
    ? `${params.bodyText.replace(/\n/g, "<br>")}<img src="${params.trackingPixelUrl}" width="1" height="1" alt="" style="display:none" />`
    : params.bodyText.replace(/\n/g, "<br>");

  const lines = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(params.subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(htmlBody, "utf-8").toString("base64"),
    "",
    `--${boundary}`,
    `Content-Type: application/pdf; name="${params.pdfFilename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${params.pdfFilename}"`,
    "",
    params.pdfBuffer.toString("base64"),
    "",
    `--${boundary}--`,
  ];

  return lines.join("\r\n");
}

export async function gmailSendRaw(
  accessToken: string,
  rawMime: string
): Promise<{ id: string; threadId: string }> {
  const raw = toBase64Url(Buffer.from(rawMime, "utf-8"));

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const data = (await res.json()) as { id: string; threadId: string };
  return data;
}
