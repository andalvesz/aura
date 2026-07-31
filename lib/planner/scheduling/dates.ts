/**
 * Suggested dates only — never writes to calendar.
 */

export function addDaysIso(from: Date | string, days: number): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function suggestPlanWindow(input: {
  effort: "LOW" | "MEDIUM" | "HIGH";
  missionDeadline?: string | null;
  asOf?: Date;
}): { start: string; target: string } {
  const asOf = input.asOf ?? new Date();
  const effortDays =
    input.effort === "LOW" ? 7 : input.effort === "MEDIUM" ? 21 : 45;
  const start = asOf.toISOString().slice(0, 10);
  let target = addDaysIso(asOf, effortDays);
  if (input.missionDeadline && input.missionDeadline < target) {
    target = input.missionDeadline;
  }
  return { start, target };
}

export function suggestStepDates(
  order: number,
  planStart: string | null,
  effort: "LOW" | "MEDIUM" | "HIGH"
): { start: string | null; deadline: string | null } {
  if (!planStart) return { start: null, deadline: null };
  const span = effort === "LOW" ? 2 : effort === "MEDIUM" ? 5 : 10;
  const offset = order * span;
  return {
    start: addDaysIso(planStart, offset),
    deadline: addDaysIso(planStart, offset + span),
  };
}
