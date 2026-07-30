import test from "node:test";
import assert from "node:assert/strict";
import {
  prioritizeMyDay,
  summarizeDayNarrative,
} from "@/lib/supabase/services/my-day-priority.service";

test("prioritizer: overdue events and budget are ALTA", () => {
  const items = prioritizeMyDay({
    overdueEvents: [{ id: "e1", titulo: "Reunião ontem" }],
    overdueHabits: [],
    pendingHabits: [],
    budgetCritical: true,
    budgetDetail: "90%",
    nearGoals: [],
    workoutPending: false,
    tripSoon: null,
    expertErrors: 0,
    todayEvents: [],
    languageDue: false,
  });
  assert.ok(items.every((i) => i.priority === "ALTA" || i.kind === "orcamento_critico"));
  assert.equal(items[0]?.priority, "ALTA");
  assert.ok(items.some((i) => i.kind === "evento_atrasado"));
  assert.ok(items.some((i) => i.kind === "orcamento_critico"));
});

test("prioritizer: expert errors ALTA; pending habits BAIXA", () => {
  const items = prioritizeMyDay({
    overdueEvents: [],
    overdueHabits: [],
    pendingHabits: [{ id: "h1", titulo: "Água" }],
    budgetCritical: false,
    nearGoals: [],
    workoutPending: true,
    tripSoon: null,
    expertErrors: 2,
    todayEvents: [],
    languageDue: true,
  });
  const expert = items.find((i) => i.kind === "expert_erro");
  const habit = items.find((i) => i.kind === "habito_pendente");
  assert.equal(expert?.priority, "ALTA");
  assert.equal(habit?.priority, "BAIXA");
  assert.ok(
    items.findIndex((i) => i.kind === "expert_erro") <
      items.findIndex((i) => i.kind === "habito_pendente")
  );
});

test("prioritizer: trip within 3 days is ALTA", () => {
  const items = prioritizeMyDay({
    overdueEvents: [],
    overdueHabits: [],
    pendingHabits: [],
    budgetCritical: false,
    nearGoals: [],
    workoutPending: false,
    tripSoon: { id: "t1", titulo: "Disney", daysRemaining: 2 },
    expertErrors: 0,
    todayEvents: [],
    languageDue: false,
  });
  assert.equal(items.find((i) => i.kind === "viagem_proxima")?.priority, "ALTA");
});

test("day narrative empty vs busy", () => {
  assert.match(
    summarizeDayNarrative({
      priorityCount: 0,
      todayEvents: 0,
      pendingHabits: 0,
      hasWorkout: true,
    }),
    /leve|planejar|dia/i
  );
  assert.match(
    summarizeDayNarrative({
      priorityCount: 2,
      todayEvents: 1,
      pendingHabits: 3,
      hasWorkout: false,
    }),
    /prioridade|evento|hábito|treino/i
  );
});

test("no fabricated priority ids without source data", () => {
  const items = prioritizeMyDay({
    overdueEvents: [],
    overdueHabits: [],
    pendingHabits: [],
    budgetCritical: false,
    nearGoals: [],
    workoutPending: false,
    tripSoon: null,
    expertErrors: 0,
    todayEvents: [],
    languageDue: false,
  });
  assert.equal(items.length, 0);
});
