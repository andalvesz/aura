import type { CommunicationLog } from "@/types/database";

export type CommsChannel = "email" | "whatsapp" | "instagram";
export type CommsStatus = "pending" | "sent" | "opened" | "failed";

export const COMMS_CHANNEL_LABELS: Record<CommsChannel, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
};

export const COMMS_STATUS_LABELS: Record<CommsStatus, string> = {
  pending: "Pendente",
  sent: "Enviado",
  opened: "Aberto",
  failed: "Erro",
};

export const COMMS_STATUS_STYLES: Record<CommsStatus, string> = {
  pending: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  sent: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  opened: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  failed: "text-red-400 bg-red-500/10 border-red-500/20",
};

export type GmailMessageSummary = {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  snippet: string;
  date: string;
  isUnread: boolean;
};

export type CommsDashboardStats = {
  emailsSent: number;
  followUpsPending: number;
  propostasSent: number;
  propostasOpened: number;
  gmailConnected: boolean;
  gmailConfigured: boolean;
};

export function getCommsStatusLabel(status: string): string {
  return COMMS_STATUS_LABELS[status as CommsStatus] ?? status;
}

export function formatGmailFrom(from: string): string {
  const match = from.match(/^([^<]+)</);
  if (match?.[1]) return match[1].trim().replace(/"/g, "");
  return from.split("@")[0]?.trim() || from;
}

export function buildTrackingPixelUrl(token: string, siteUrl?: string): string {
  const base = (siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  return `${base}/api/comms/track/${token}`;
}

export function isCommunicationOpened(log: Pick<CommunicationLog, "status" | "opened_at">): boolean {
  return log.status === "opened" || Boolean(log.opened_at);
}
