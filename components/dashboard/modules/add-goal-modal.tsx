"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { FORM_GRID_2_CLASS } from "@/utils/dashboard-mobile";
import type { GoalTipo } from "@/types/database";
import { GOAL_TIPO_OPTIONS } from "@/utils/goals";
import { resetHtmlForm } from "@/utils/html-form";

type AddGoalModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    titulo: string;
    tipo: GoalTipo;
    meta: number;
    data_inicio: string;
    data_fim: string;
    atual?: number;
  }) => Promise<{ error: string | null }>;
};

export function AddGoalModal({ open, onClose, onSubmit }: AddGoalModalProps) {
  const [pending, setPending] = useState(false);
  const [tipo, setTipo] = useState<GoalTipo>("financeira");
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const example = GOAL_TIPO_OPTIONS.find((o) => o.id === tipo)?.example ?? "";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const titulo = String(fd.get("titulo")).trim();
    const meta = Number(fd.get("meta"));
    const data_inicio = String(fd.get("data_inicio"));
    const data_fim = String(fd.get("data_fim"));
    const atualRaw = fd.get("atual");
    const atual =
      tipo === "personalizada" && atualRaw ? Number(atualRaw) : undefined;

    if (!titulo || !meta || meta <= 0) {
      toast.error("Preencha título e meta válidos.");
      return;
    }

    if (data_fim < data_inicio) {
      toast.error("Data fim deve ser após o início.");
      return;
    }

    setPending(true);
    const { error } = await onSubmit({
      titulo,
      tipo,
      meta,
      data_inicio,
      data_fim,
      atual,
    });
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Meta criada.");
    resetHtmlForm(form);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova meta"
      description={example}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-[12px] text-zinc-400">
          Tipo
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as GoalTipo)}
            className="mt-1 w-full rounded-md border border-white/[0.08] bg-zinc-950 px-3 py-2 text-[13px] text-zinc-200"
          >
            {GOAL_TIPO_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[12px] text-zinc-400">
          Título
          <input
            name="titulo"
            required
            placeholder={example}
            className="mt-1 w-full rounded-md border border-white/[0.08] bg-zinc-950 px-3 py-2 text-[13px] text-zinc-200"
          />
        </label>

        <label className="block text-[12px] text-zinc-400">
          Meta {tipo === "financeira" ? "(R$)" : "(quantidade)"}
          <input
            name="meta"
            type="number"
            min="0.01"
            step={tipo === "financeira" ? "0.01" : "1"}
            required
            className="mt-1 w-full rounded-md border border-white/[0.08] bg-zinc-950 px-3 py-2 text-[13px] text-zinc-200"
          />
        </label>

        {tipo === "personalizada" && (
          <label className="block text-[12px] text-zinc-400">
            Progresso atual (opcional)
            <input
              name="atual"
              type="number"
              min="0"
              step="1"
              defaultValue="0"
              className="mt-1 w-full rounded-md border border-white/[0.08] bg-zinc-950 px-3 py-2 text-[13px] text-zinc-200"
            />
          </label>
        )}

        <div className={FORM_GRID_2_CLASS}>
          <label className="block text-[12px] text-zinc-400">
            Início
            <input
              name="data_inicio"
              type="date"
              required
              defaultValue={monthStart}
              className="mt-1 w-full rounded-md border border-white/[0.08] bg-zinc-950 px-3 py-2 text-[13px] text-zinc-200"
            />
          </label>
          <label className="block text-[12px] text-zinc-400">
            Fim
            <input
              name="data_fim"
              type="date"
              required
              defaultValue={monthEnd}
              className="mt-1 w-full rounded-md border border-white/[0.08] bg-zinc-950 px-3 py-2 text-[13px] text-zinc-200"
            />
          </label>
        </div>

        {tipo !== "personalizada" && (
          <p className="text-[11px] text-zinc-600">
            O progresso será atualizado automaticamente com dados reais da Aura.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="flex w-full min-h-10 items-center justify-center gap-2 rounded-md bg-cyan-600 px-4 text-[13px] font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Criar meta
        </button>
      </form>
    </Modal>
  );
}
