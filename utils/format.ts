export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function isValidDate(value: unknown): boolean {
  if (value == null || value === "") return false;
  if (typeof value === "string" && value.trim().toLowerCase() === "invalid date") {
    return false;
  }
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  const date = new Date(value as string | number);
  return !Number.isNaN(date.getTime());
}

function toDate(value: string | Date): Date | null {
  if (value instanceof Date) {
    return isValidDate(value) ? value : null;
  }
  if (!isValidDate(value)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`);
  }
  return new Date(value);
}

export function formatSafeDate(
  value: unknown,
  fallback = "Data não definida"
): string {
  if (!isValidDate(value)) return fallback;
  try {
    const date = value instanceof Date ? value : new Date(value as string);
    return new Intl.DateTimeFormat("pt-BR").format(date);
  } catch {
    return fallback;
  }
}

export function formatSafeTime(
  value: unknown,
  fallback = "Horário não definido"
): string {
  if (!isValidDate(value)) return fallback;
  try {
    const date = value instanceof Date ? value : new Date(value as string);
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return fallback;
  }
}

export function formatDate(
  date: string | Date,
  fallback = "Data não definida"
) {
  const parsed = toDate(date);
  if (!parsed) return fallback;
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
    }).format(parsed);
  } catch {
    return fallback;
  }
}

export function formatTime(date: string, fallback = "Horário não definido") {
  return formatSafeTime(date, fallback);
}

export function isToday(dateStr: string) {
  if (!isValidDate(dateStr)) return false;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? new Date(`${dateStr}T12:00:00`)
    : new Date(dateStr);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}
