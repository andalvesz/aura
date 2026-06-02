import type { Evento } from "@/types/database";
import { formatTime } from "@/utils/format";

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

export function buildEventoDateTime(data: string, hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  const base = new Date(`${data}T12:00:00`);
  base.setHours(h ?? 9, m ?? 0, 0, 0);
  return base.toISOString();
}

export function splitEventoDateTime(iso: string): { data: string; hora: string } {
  const d = new Date(iso);
  const data = d.toISOString().slice(0, 10);
  const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { data, hora };
}

export function eventosNoDia(eventos: Evento[], year: number, month: number, day: number) {
  return eventos.filter((e) => {
    const d = new Date(e.data_inicio);
    return (
      d.getFullYear() === year &&
      d.getMonth() === month &&
      d.getDate() === day
    );
  });
}

export function diasComEventos(eventos: Evento[], year: number, month: number): number[] {
  const days = new Set<number>();
  for (const e of eventos) {
    const d = new Date(e.data_inicio);
    if (d.getFullYear() === year && d.getMonth() === month) {
      days.add(d.getDate());
    }
  }
  return [...days];
}

export function proximosEventos(eventos: Evento[], limit = 8): Evento[] {
  const now = Date.now();
  return [...eventos]
    .filter((e) => new Date(e.data_inicio).getTime() >= now - 60_000)
    .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime())
    .slice(0, limit);
}

export function formatEventoResumo(evento: Evento) {
  return `${formatTime(evento.data_inicio)} · ${evento.titulo}`;
}

export function getEventoTipoLabel(tipo: string) {
  return EVENTO_TIPOS.find((t) => t.id === tipo)?.label ?? tipo;
}
