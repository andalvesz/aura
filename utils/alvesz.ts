export function estoqueStatus(
  quantidade: number,
  minimo: number
): "ok" | "low" | "critical" {
  if (quantidade <= minimo * 0.5) return "critical";
  if (quantidade <= minimo) return "low";
  return "ok";
}

export const ESTOQUE_STATUS_STYLE: Record<string, string> = {
  ok: "text-emerald-400",
  low: "text-amber-400",
  critical: "text-red-400",
};

export function calcLucroEstimado(valorTotal: number, margin = 0.38) {
  return Math.round(valorTotal * margin * 100) / 100;
}

export function calcPrecoSugerido(convidados: number, horas: number, ratePerGuestHour = 28) {
  return Math.round(convidados * horas * ratePerGuestHour);
}
