import type { Gasto } from "@/types/database";

export const ORCAMENTO_MENSAL = 6000;

export const GASTO_CATEGORIAS = [
  { value: "alimentacao", label: "Alimentação", color: "bg-emerald-500" },
  { value: "transporte", label: "Transporte", color: "bg-sky-500" },
  { value: "lazer", label: "Lazer", color: "bg-violet-500" },
  { value: "trabalho", label: "Trabalho", color: "bg-amber-500" },
  { value: "saude", label: "Saúde", color: "bg-rose-500" },
  { value: "outros", label: "Outros", color: "bg-zinc-500" },
] as const;

export function getCategoryLabel(value: string) {
  return GASTO_CATEGORIAS.find((c) => c.value === value)?.label ?? value;
}

export function getCategoryColor(value: string) {
  return GASTO_CATEGORIAS.find((c) => c.value === value)?.color ?? "bg-zinc-500";
}

export function filterGastosCurrentMonth(gastos: Gasto[]) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return gastos.filter((g) => {
    const d = new Date(g.data + "T12:00:00");
    return d.getFullYear() === y && d.getMonth() === m;
  });
}

export function computeFinanceStats(gastos: Gasto[]) {
  const monthGastos = filterGastosCurrentMonth(gastos);
  const totalMonth = monthGastos.reduce((s, g) => s + Number(g.valor), 0);

  const byCategory = new Map<string, number>();
  monthGastos.forEach((g) => {
    byCategory.set(g.categoria, (byCategory.get(g.categoria) ?? 0) + Number(g.valor));
  });

  const categories = Array.from(byCategory.entries())
    .map(([key, total]) => ({
      key,
      label: getCategoryLabel(key),
      total,
      pct: totalMonth > 0 ? Math.round((total / totalMonth) * 100) : 0,
      color: getCategoryColor(key),
    }))
    .sort((a, b) => b.total - a.total);

  const topCategory = categories[0];

  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyAvg = dayOfMonth > 0 ? totalMonth / dayOfMonth : 0;
  const forecast = dailyAvg * daysInMonth;
  const saldo = ORCAMENTO_MENSAL - totalMonth;

  return {
    monthGastos,
    totalMonth,
    categories,
    topCategory,
    forecast,
    saldo,
    dayOfMonth,
    daysInMonth,
  };
}
