"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ActionButton } from "@/components/dashboard/action-button";
import { AddGastoModal } from "@/components/dashboard/modules/add-gasto-modal";
import { AddReceitaModal } from "@/components/dashboard/modules/add-receita-modal";
import { AddEventoModal } from "@/components/dashboard/modules/add-evento-modal";
import { AddGoalModal } from "@/components/dashboard/modules/add-goal-modal";
import { AddHealthHabitModal } from "@/components/dashboard/modules/add-health-habit-modal";
import { AddClienteModal } from "@/components/dashboard/modules/add-cliente-modal";
import { AddOrcamentoModal } from "@/components/dashboard/modules/add-orcamento-modal";
import { AddAlveszEventoModal } from "@/components/dashboard/modules/add-alvesz-evento-modal";
import {
  useGastos,
  useFinancialIncome,
  useEventos,
  useGoals,
  useHealthHabits,
  useClientes,
  useOrcamentos,
  useAlveszEventos,
} from "@/hooks";
import {
  filterQuickActionsForRole,
  PERSONAL_QUICK_ACTIONS,
  WORKSPACE_QUICK_ACTIONS,
  type DashboardQuickAction,
} from "@/lib/dashboard/context-dashboard";
import type { WorkspaceRole } from "@/lib/workspace/constants";

type QuickActionsProps = {
  mode: "personal" | "workspace";
  role?: WorkspaceRole | null;
};

export function QuickActions({ mode, role = null }: QuickActionsProps) {
  const actions =
    mode === "personal"
      ? PERSONAL_QUICK_ACTIONS
      : filterQuickActionsForRole(WORKSPACE_QUICK_ACTIONS, role);

  const [open, setOpen] = useState<string | null>(null);

  const gastos = useGastos();
  const income = useFinancialIncome();
  const eventos = useEventos();
  const goals = useGoals();
  const habits = useHealthHabits();
  const clientes = useClientes();
  const orcamentos = useOrcamentos();
  const alveszEventos = useAlveszEventos();

  function onAction(a: DashboardQuickAction) {
    if (a.href) return;
    if (a.modal) setOpen(a.modal);
  }

  return (
    <section aria-label="Atalhos rápidos" className="space-y-2">
      <h2 className="text-[13px] font-medium text-zinc-200">Atalhos</h2>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) =>
          a.href ? (
            <Link key={a.id} href={a.href}>
              <ActionButton type="button">{a.label}</ActionButton>
            </Link>
          ) : (
            <ActionButton key={a.id} type="button" onClick={() => onAction(a)}>
              {a.label}
            </ActionButton>
          )
        )}
      </div>

      {mode === "personal" ? (
        <>
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
          <AddHealthHabitModal
            open={open === "habit"}
            onClose={() => setOpen(null)}
            onSubmit={async (payload) => {
              const r = await habits.create(payload);
              if (!r.error) {
                toast.success("Hábito registrado");
                setOpen(null);
              }
              return { error: r.error };
            }}
          />
        </>
      ) : (
        <>
          <AddClienteModal
            open={open === "cliente"}
            onClose={() => setOpen(null)}
            onSubmit={async (payload) => {
              const r = await clientes.create({
                ...payload,
                email: null,
                tipo: "pessoa_fisica",
              });
              if (!r.error) {
                toast.success("Cliente criado");
                setOpen(null);
              }
              return { error: r.error };
            }}
          />
          <AddOrcamentoModal
            open={open === "orcamento"}
            onClose={() => setOpen(null)}
            clientes={clientes.data}
            onSubmit={async (payload) => {
              const { criarLead: _criarLead, ...rest } = payload;
              const r = await orcamentos.create(rest);
              if (!r.error) {
                toast.success("Orçamento criado");
                setOpen(null);
              }
              return { error: r.error };
            }}
          />
          <AddAlveszEventoModal
            open={open === "alvesz-evento"}
            onClose={() => setOpen(null)}
            clientes={clientes.data}
            onSubmit={async (payload) => {
              const r = await alveszEventos.create(payload);
              if (!r.error) {
                toast.success("Evento Alvesz criado");
                setOpen(null);
              }
              return { error: r.error };
            }}
          />
        </>
      )}
    </section>
  );
}
