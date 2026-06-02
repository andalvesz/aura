"use client";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { todayIsoDate } from "@/utils/health";

type AddHealthMealModalProps = {
  open: boolean;
  onClose: () => void;
  initial?: {
    nome: string;
    horario: string;
    alimentos: string;
    calorias?: number | null;
    observacoes?: string | null;
  } | null;
  onSubmit: (payload: {
    nome: string;
    horario: string;
    alimentos: string | null;
    calorias: number | null;
    observacoes: string | null;
    data: string;
  }) => Promise<{ error: string | null }>;
};

export function AddHealthMealModal({
  open,
  onClose,
  initial,
  onSubmit,
}: AddHealthMealModalProps) {
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome")).trim();
    const horario = String(fd.get("horario"));
    if (!nome || !horario) {
      toast.error("Preencha nome e horário.");
      return;
    }

    const calRaw = String(fd.get("calorias") ?? "");
    const calorias = calRaw ? Math.max(0, Number(calRaw)) : null;

    setPending(true);
    const { error } = await onSubmit({
      nome,
      horario: horario.length === 5 ? `${horario}:00` : horario,
      alimentos: String(fd.get("alimentos") ?? "").trim() || null,
      calorias,
      observacoes: String(fd.get("observacoes") ?? "").trim() || null,
      data: todayIsoDate(),
    });
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Refeição cadastrada.");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Confirmar refeição sugerida" : "Nova refeição"}
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-3" key={initial?.nome ?? "new"}>
        <Field label="Nome" name="nome" required defaultValue={initial?.nome} />
        <Field label="Horário" name="horario" type="time" required defaultValue={initial?.horario?.slice(0, 5)} />
        <label className="block text-[12px] text-zinc-500">
          Alimentos
          <textarea
            name="alimentos"
            defaultValue={initial?.alimentos}
            rows={3}
            className="mt-1 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[13px] text-zinc-200"
          />
        </label>
        <Field
          label="Calorias (opcional)"
          name="calorias"
          type="number"
          min="0"
          defaultValue={initial?.calorias != null ? String(initial.calorias) : ""}
        />
        <label className="block text-[12px] text-zinc-500">
          Observações
          <textarea
            name="observacoes"
            defaultValue={initial?.observacoes ?? ""}
            rows={2}
            className="mt-1 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[13px] text-zinc-200"
          />
        </label>
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
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  min?: string;
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
        className="mt-1 h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px] text-zinc-200"
      />
    </label>
  );
}
