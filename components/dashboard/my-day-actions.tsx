"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { AddGastoModal } from "@/components/dashboard/modules/add-gasto-modal";
import { AddReceitaModal } from "@/components/dashboard/modules/add-receita-modal";
import { AddEventoModal } from "@/components/dashboard/modules/add-evento-modal";
import { AddGoalModal } from "@/components/dashboard/modules/add-goal-modal";
import {
  completeHabitAction,
  updateGoalProgressAction,
} from "@/app/actions/my-day";
import { useGastos, useFinancialIncome, useEventos, useGoals } from "@/hooks";

export function MyDayQuickBar() {
  const [open, setOpen] = useState<string | null>(null);
  const gastos = useGastos();
  const income = useFinancialIncome();
  const eventos = useEventos();
  const goals = useGoals();

  return (
    <section aria-label="Ações rápidas do Meu Dia" className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <ActionButton type="button" onClick={() => setOpen("gasto")}>
          Registrar despesa
        </ActionButton>
        <ActionButton type="button" onClick={() => setOpen("receita")}>
          Registrar receita
        </ActionButton>
        <ActionButton type="button" onClick={() => setOpen("evento")}>
          Criar evento
        </ActionButton>
        <ActionButton type="button" onClick={() => setOpen("goal")}>
          Criar objetivo
        </ActionButton>
        <Link href="/dashboard/saude">
          <ActionButton type="button">Abrir treino</ActionButton>
        </Link>
        <Link href="/dashboard/expert-brain">
          <ActionButton type="button">Abrir Expert Brain</ActionButton>
        </Link>
      </div>

      <AddGastoModal
        open={open === "gasto"}
        onClose={() => setOpen(null)}
        onSubmit={async (payload) => {
          const r = await gastos.create(payload);
          if (!r.error) {
            toast.success("Despesa registrada");
            setOpen(null);
          }
          return { error: r.error };
        }}
      />
      <AddReceitaModal
        open={open === "receita"}
        onClose={() => setOpen(null)}
        onSubmit={async (payload) => {
          const r = await income.create(payload);
          if (!r.error) {
            toast.success("Receita registrada");
            setOpen(null);
          }
          return { error: r.error };
        }}
      />
      <AddEventoModal
        open={open === "evento"}
        onClose={() => setOpen(null)}
        onSubmit={async (payload) => {
          const r = await eventos.create(payload);
          if (!r.error) {
            toast.success("Evento criado");
            setOpen(null);
          }
          return { error: r.error };
        }}
      />
      <AddGoalModal
        open={open === "goal"}
        onClose={() => setOpen(null)}
        onSubmit={async (payload) => {
          const r = await goals.create({
            ...payload,
            atual: payload.atual ?? 0,
            status: "ativa",
          } as Parameters<typeof goals.create>[0]);
          if (!r.error) {
            toast.success("Objetivo criado");
            setOpen(null);
          }
          return { error: r.error };
        }}
      />
    </section>
  );
}

export function CompleteHabitButton({
  habitId,
  label = "Concluir",
}: {
  habitId: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <ActionButton
      type="button"
      variant="ghost"
      disabled={pending}
      aria-label={`Concluir hábito`}
      onClick={() => {
        startTransition(async () => {
          const { error } = await completeHabitAction(habitId);
          if (error) {
            toast.error(error);
            return;
          }
          toast.success("Hábito concluído");
          router.refresh();
        });
      }}
    >
      {pending ? "…" : label}
    </ActionButton>
  );
}

export function UpdateGoalProgressButton({
  goalId,
  current,
  meta,
}: {
  goalId: string;
  current: number;
  meta: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(current));

  return (
    <div className="space-y-2">
      <ActionButton type="button" variant="ghost" onClick={() => setOpen((v) => !v)}>
        Atualizar progresso
      </ActionButton>
      {open ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const atual = Number(value);
            startTransition(async () => {
              const { error } = await updateGoalProgressAction({ goalId, atual });
              if (error) {
                toast.error(error);
                return;
              }
              toast.success("Progresso atualizado");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <label className="text-[11px] text-zinc-500">
            Atual (meta {meta})
            <input
              className="mt-1 block w-28 rounded-md border border-white/[0.08] bg-zinc-950 px-2 py-1.5 text-[12px] text-zinc-100"
              type="number"
              min={0}
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={pending}
            />
          </label>
          <ActionButton type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </ActionButton>
        </form>
      ) : null}
    </div>
  );
}
