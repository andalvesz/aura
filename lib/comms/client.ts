import type { CommsChannel } from "@/utils/comms";

export async function logCommsContactClient(params: {
  channel: CommsChannel;
  bodyPreview: string;
  recipient?: string;
  subject?: string;
  clienteId?: string | null;
  orcamentoId?: string | null;
  leadId?: string | null;
  propostaId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await fetch("/api/comms/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch {
    /* registro complementar */
  }
}
