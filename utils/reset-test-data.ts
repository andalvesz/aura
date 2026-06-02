import type { UserScopedTable } from "@/types/database";

/** Ordem respeitando FKs (filhos antes dos pais referenciados). */
export const RESET_TEST_DATA_TABLES = [
  "alvesz_eventos",
  "eventos",
  "orcamentos",
  "growth_missions",
  "growth_goals",
  "growth_leads",
  "clientes",
  "estoque",
  "conteudos",
  "health_sessions",
  "health_workouts",
  "health_meals",
  "health_habits",
] as const satisfies readonly UserScopedTable[];

export type ResetTestDataTable = (typeof RESET_TEST_DATA_TABLES)[number];

export type ResetTestDataCounts = {
  leads: number;
  eventos: number;
  clientes: number;
  conteudos: number;
  habits: number;
  workouts: number;
  meals: number;
};

export const RESET_TEST_DATA_COUNT_SOURCES: {
  key: keyof ResetTestDataCounts;
  table: ResetTestDataTable;
}[] = [
  { key: "leads", table: "growth_leads" },
  { key: "eventos", table: "eventos" },
  { key: "clientes", table: "clientes" },
  { key: "conteudos", table: "conteudos" },
  { key: "habits", table: "health_habits" },
  { key: "workouts", table: "health_workouts" },
  { key: "meals", table: "health_meals" },
];

export function isResetCountsEmpty(counts: ResetTestDataCounts): boolean {
  return Object.values(counts).every((n) => n === 0);
}
