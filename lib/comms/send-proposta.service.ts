import { getDataContext } from "@/lib/supabase/services/context";
import {
  buildMimeWithPdf,
  gmailSendRaw,
} from "@/lib/gmail/api";
import { getGoogleAccountConnection, getValidGoogleAccessToken } from "@/lib/google/token.service";
import type { AlveszPropostaPdfMeta } from "@/utils/alvesz-proposta";
import { buildTrackingPixelUrl } from "@/utils/comms";
import { logOutboundMessage } from "./communication.service";

const BUCKET = "alvesz-pdfs";

export async function sendPropostaByEmail(params: {
  propostaId: string;
  toEmail: string;
  subject?: string;
  body?: string;
}): Promise<{ error: string | null; logId?: string }> {
  const { accessToken, error: tokenError, gmailEnabled } = await getValidGoogleAccessToken();

  if (tokenError || !accessToken) {
    return { error: tokenError ?? "Conecte o Gmail em Comunicação." };
  }
  if (!gmailEnabled) {
    return { error: "Gmail não autorizado. Reconecte em Comunicação com permissão de e-mail." };
  }

  const { supabase, userId } = await getDataContext();

  const { data: proposta, error: propError } = await supabase
    .from("alvesz_propostas")
    .select("id, orcamento_id, conteudo, pdf_meta")
    .eq("id", params.propostaId)
    .eq("user_id", userId)
    .maybeSingle();

  if (propError || !proposta) {
    return { error: "Proposta não encontrada." };
  }

  const { data: orcamento } = await supabase
    .from("orcamentos")
    .select("id, cliente_id, tipo_evento, valor_total")
    .eq("id", proposta.orcamento_id)
    .maybeSingle();

  const meta = proposta.pdf_meta as AlveszPropostaPdfMeta | null;
  if (!meta?.storagePath) {
    return { error: "Gere o PDF da proposta antes de enviar por e-mail." };
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(meta.storagePath);

  if (downloadError || !file) {
    return { error: "PDF da proposta não encontrado." };
  }

  const pdfBuffer = Buffer.from(await file.arrayBuffer());
  const { connection } = await getGoogleAccountConnection();
  const fromEmail = connection?.google_email;
  if (!fromEmail) {
    return { error: "E-mail da conta Google não disponível." };
  }

  const subject =
    params.subject?.trim() ||
    `Proposta Alvesz Experience — ${orcamento?.tipo_evento ?? "seu evento"}`;

  const bodyText =
    params.body?.trim() ||
    `Olá,\n\nSegue em anexo a proposta Alvesz Experience para o seu evento.\n\nFico à disposição para alinhar detalhes.\n\nAtenciosamente,\nAnderson Alves\nAlvesz Experience`;

  const { data: logRow } = await logOutboundMessage({
    channel: "email",
    status: "pending",
    subject,
    bodyPreview: bodyText,
    recipient: params.toEmail,
    clienteId: orcamento?.cliente_id ?? null,
    orcamentoId: proposta.orcamento_id,
    propostaId: proposta.id,
    metadata: { tipo: "proposta_pdf" },
  });

  const trackingUrl = logRow?.tracking_token
    ? buildTrackingPixelUrl(logRow.tracking_token)
    : undefined;

  try {
    const mime = buildMimeWithPdf({
      from: fromEmail,
      to: params.toEmail,
      subject,
      bodyText,
      pdfBuffer,
      pdfFilename: `proposta-alvesz-v${meta.version ?? 1}.pdf`,
      trackingPixelUrl: trackingUrl,
    });

    const sent = await gmailSendRaw(accessToken, mime);

    if (logRow?.id) {
      await supabase
        .from("communication_logs")
        .update({
          status: "sent",
          gmail_message_id: sent.id,
          gmail_thread_id: sent.threadId,
        })
        .eq("id", logRow.id);
    }

    return { error: null, logId: logRow?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao enviar e-mail.";
    if (logRow?.id) {
      await supabase
        .from("communication_logs")
        .update({ status: "failed", metadata: { error: message } })
        .eq("id", logRow.id);
    }
    return { error: message };
  }
}
