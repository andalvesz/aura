export const WHATSAPP_NO_PHONE_MESSAGE =
  "Adicione telefone para enviar no WhatsApp";

export function normalizeBrazilPhone(
  raw: string | null | undefined
): string | null {
  if (!raw?.trim()) return null;

  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
  }

  if (digits.length < 10) return null;

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }

  if (digits.length >= 12) {
    return digits.startsWith("55") ? digits : `55${digits}`;
  }

  return null;
}

export function buildWaMeUrl(phone: string, message: string): string {
  const normalized =
    normalizeBrazilPhone(phone) ?? phone.replace(/\D/g, "");
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export type OpenWhatsAppResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export function openWhatsAppLink(
  phone: string | null | undefined,
  message: string
): OpenWhatsAppResult {
  const normalized = normalizeBrazilPhone(phone);
  if (!normalized) {
    return { ok: false, error: WHATSAPP_NO_PHONE_MESSAGE };
  }

  if (!message.trim()) {
    return { ok: false, error: "Escreva uma mensagem antes de abrir o WhatsApp." };
  }

  const url = buildWaMeUrl(normalized, message.trim());

  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return { ok: true, url };
}
