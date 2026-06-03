"use client";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { AlveszEvento, Cliente } from "@/types/database";

type AddAlveszEventoModalProps = {
  open: boolean;
  onClose: () => void;
  clientes: Cliente[];
  initial?: AlveszEvento | null;
  syncCalendar?: boolean;
  onSyncCalendarChange?: (v: boolean) => void;
  onSubmit: (payload: {
    titulo: string;
    data_evento: string;
    local: string | null;
    cliente_id: string | null;
    valor_fechado: number;
  }) => Promise<{ error: string | null }>;
};

export function AddAlveszEventoModal({
  open,
  onClose,
  clientes,
  initial,
  syncCalendar = true,
  onSyncCalendarChange,
  onSubmit,
}: AddAlveszEventoModalProps) {
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const titulo = String(fd.get("titulo")).trim();
    const data_evento = String(fd.get("data_evento"));
    if (!titulo || !data_evento) {
      toast.error("Preencha título e data.");
      return;
    }

    setPending(true);
    const { error } = await onSubmit({
      titulo,
      data_evento,
      local: String(fd.get("local") ?? "").trim() || null,
      cliente_id: String(fd.get("cliente_id") || "") || null,
      valor_fechado: Number(fd.get("valor_fechado")) || 0,
    });
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(initial ? "Evento atualizado." : "Evento criado.");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Editar evento" : "Novo evento"}
      description="Evento confirmado da Alvesz Experience."
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-3" key={initial?.id ?? "new"}>
        <Field label="Título" name="titulo" defaultValue={initial?.titulo} required />
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Data"
            name="data_evento"
            type="date"
            defaultValue={initial?.data_evento}
            required
          />
          <Field
            label="Valor fechado (R$)"
            name="valor_fechado"
            type="number"
            min="0"
            step="0.01"
            defaultValue={String(initial?.valor_fechado ?? 0)}
          />
        </div>
        <Field label="Local" name="local" defaultValue={initial?.local ?? ""} />
        <label className="block text-[12px] text-zinc-500">
          Cliente
          <select
            name="cliente_id"
            defaultValue={initial?.cliente_id ?? ""}
            className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
          >
            <option value="">Sem cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id} className="bg-zinc-900">
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        {!initial && onSyncCalendarChange && (
          <label className="flex items-center gap-2 text-[12px] text-zinc-400">
            <input
              type="checkbox"
              checked={syncCalendar}
              onChange={(e) => onSyncCalendarChange(e.target.checked)}
              className="rounded border-white/20"
            />
            Criar também no Calendário
          </label>
        )}
        <button
          type="submit"
          disabled={pending}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-[13px] font-medium disabled:opacity-50"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          Salvar
        </button>
      </form>
    </Modal>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
  min,
  step,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  min?: string;
  step?: string;
}) {
  return (
    <label className="block text-[12px] text-zinc-500">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        min={min}
        step={step}
        className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
      />
    </label>
  );
}
