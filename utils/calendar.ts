import type { Evento } from "@/types/database";

export function isValidEventoDate(value: string | null | undefined): value is string {
  if (!value || typeof value !== "string") return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time);
}

export function formatEventoDateDisplay(iso: string): string {
  if (!isValidEventoDate(iso)) return "Data não definida";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
    }).format(new Date(iso));
  } catch {
    return "Data não definida";
  }
}

export function formatEventoTimeDisplay(iso: string): string {
  if (!isValidEventoDate(iso)) return "--:--";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "--:--";
  }
}

function safeEventosList(eventos: Evento[] | null | undefined): Evento[] {
  return Array.isArray(eventos) ? eventos : [];
}

export const EVENTO_TIPOS = [
  { id: "geral", label: "Geral" },
  { id: "reuniao", label: "Reunião" },
  { id: "evento", label: "Evento" },
  { id: "followup", label: "Follow-up" },
  { id: "social", label: "Social / Conteúdo" },
] as const;

export type EventoTipo = (typeof EVENTO_TIPOS)[number]["id"];

export type ParsedEventoSuggestion = {
  titulo: string;
  descricao: string | null;
  data: string;
  hora: string;
  tipo: string;
};

export type EventoCreatePayload = {
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  local: string | null;
  tipo: string;
  growth_lead_id: string | null;
};

const EVENTO_CONFIRMATION_PHRASES = new Set([
  "confirmado",
  "confirmar",
  "sim",
  "ok",
  "salvar",
]);

export function normalizeAgendaMessage(message: string): string {
  return message
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[!?.。,;:]+$/g, "")
    .trim();
}

export function isEventoConfirmationMessage(message: string): boolean {
  return EVENTO_CONFIRMATION_PHRASES.has(normalizeAgendaMessage(message));
}

export function eventoPayloadFromSuggestion(
  suggestion: ParsedEventoSuggestion
): EventoCreatePayload {
  return {
    titulo: suggestion.titulo,
    descricao: suggestion.descricao,
    data_inicio: buildEventoDateTime(suggestion.data, suggestion.hora),
    local: null,
    tipo: suggestion.tipo,
    growth_lead_id: null,
  };
}

export function buildEventoDateTime(data: string, hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  const base = new Date(`${data}T12:00:00`);
  base.setHours(h ?? 9, m ?? 0, 0, 0);
  return base.toISOString();
}

export function splitEventoDateTime(iso: string): { data: string; hora: string } {
  const fallback = {
    data: new Date().toISOString().slice(0, 10),
    hora: "09:00",
  };
  if (!isValidEventoDate(iso)) return fallback;

  const d = new Date(iso);
  try {
    const data = d.toISOString().slice(0, 10);
    const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return { data, hora };
  } catch {
    return fallback;
  }
}

export function eventosNoDia(
  eventos: Evento[] | null | undefined,
  year: number,
  month: number,
  day: number
) {
  return safeEventosList(eventos).filter((e) => {
    if (!isValidEventoDate(e.data_inicio)) return false;
    const d = new Date(e.data_inicio);
    return (
      d.getFullYear() === year &&
      d.getMonth() === month &&
      d.getDate() === day
    );
  });
}

export function diasComEventos(
  eventos: Evento[] | null | undefined,
  year: number,
  month: number
): number[] {
  const days = new Set<number>();
  for (const e of safeEventosList(eventos)) {
    if (!isValidEventoDate(e.data_inicio)) continue;
    const d = new Date(e.data_inicio);
    if (d.getFullYear() === year && d.getMonth() === month) {
      days.add(d.getDate());
    }
  }
  return [...days];
}

export function proximosEventos(
  eventos: Evento[] | null | undefined,
  limit = 8
): Evento[] {
  const now = Date.now();
  return safeEventosList(eventos)
    .filter((e) => {
      if (!isValidEventoDate(e.data_inicio)) return false;
      return new Date(e.data_inicio).getTime() >= now - 60_000;
    })
    .sort(
      (a, b) =>
        new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime()
    )
    .slice(0, limit);
}

export function formatEventoResumo(evento: Evento) {
  return `${formatEventoTimeDisplay(evento.data_inicio)} · ${evento.titulo ?? "Sem título"}`;
}

export function getEventoTipoLabel(tipo: string) {
  return EVENTO_TIPOS.find((t) => t.id === tipo)?.label ?? tipo;
}
