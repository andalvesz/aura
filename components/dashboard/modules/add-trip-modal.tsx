"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { FORM_GRID_2_CLASS } from "@/utils/dashboard-mobile";
import type { TripStatus } from "@/types/database";
import { TRAVEL_TEMPLATE_LIST, addDaysToIsoDate } from "@/utils/travel-templates";

type AddTripModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    nome: string;
    destino: string;
    data_ida: string;
    data_volta: string;
    orcamento: number;
    status: TripStatus;
    template_id: string | null;
  }) => Promise<{ error: string | null }>;
};

export function AddTripModal({ open, onClose, onSubmit }: AddTripModalProps) {
  const [pending, setPending] = useState(false);
  const [templateId, setTemplateId] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const defaultVolta = addDaysToIsoDate(today, 7);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome")).trim();
    const destino = String(fd.get("destino")).trim();
    const data_ida = String(fd.get("data_ida"));
    const data_volta = String(fd.get("data_volta"));
    const orcamento = Number(fd.get("orcamento")) || 0;

    if (!nome || !destino || !data_ida || !data_volta) {
      toast.error("Preencha nome, destino e datas.");
      return;
    }

    if (data_volta < data_ida) {
      toast.error("Data de volta deve ser após a ida.");
      return;
    }

    setPending(true);
    const { error } = await onSubmit({
      nome,
      destino,
      data_ida,
      data_volta,
      orcamento,
      status: "planejando" as TripStatus,
      template_id: templateId || null,
    });
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Viagem criada.");
    onClose();
  }

  function handleTemplateChange(value: string) {
    setTemplateId(value);
    const template = TRAVEL_TEMPLATE_LIST.find((t) => t.id === value);
    if (!template) return;

    const form = document.getElementById("add-trip-form") as HTMLFormElement | null;
    if (!form) return;

    const nomeInput = form.elements.namedItem("nome") as HTMLInputElement | null;
    const destinoInput = form.elements.namedItem("destino") as HTMLInputElement | null;
    const orcamentoInput = form.elements.namedItem("orcamento") as HTMLInputElement | null;
    const idaInput = form.elements.namedItem("data_ida") as HTMLInputElement | null;
    const voltaInput = form.elements.namedItem("data_volta") as HTMLInputElement | null;

    if (nomeInput) nomeInput.value = template.nome;
    if (destinoInput) destinoInput.value = template.destino;
    if (orcamentoInput) orcamentoInput.value = String(template.orcamentoSugerido);
    if (idaInput && voltaInput) {
      const ida = idaInput.value || today;
      voltaInput.value = addDaysToIsoDate(ida, template.diasSugeridos);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova viagem" className="max-w-lg">
      <form id="add-trip-form" onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-[12px] text-zinc-500">
          Template
          <select
            value={templateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
          >
            <option value="" className="bg-zinc-900">
              Viagem personalizada
            </option>
            {TRAVEL_TEMPLATE_LIST.map((t) => (
              <option key={t.id} value={t.id} className="bg-zinc-900">
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <Field label="Nome" name="nome" required placeholder="Ex: Disney + NBA 2026" />
        <Field label="Destino" name="destino" required placeholder="Ex: Orlando, FL" />

        <div className={FORM_GRID_2_CLASS}>
          <Field label="Data ida" name="data_ida" type="date" required defaultValue={today} />
          <Field
            label="Data volta"
            name="data_volta"
            type="date"
            required
            defaultValue={defaultVolta}
          />
        </div>

        <Field
          label="Orçamento (R$)"
          name="orcamento"
          type="number"
          min="0"
          step="0.01"
          placeholder="0"
        />

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-md px-4 text-[13px] text-zinc-400 hover:text-zinc-200 md:min-h-9"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex min-h-11 items-center gap-2 rounded-md bg-white/[0.08] px-4 text-[13px] font-medium text-zinc-100 hover:bg-white/[0.12] disabled:opacity-50 md:min-h-9"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Criar viagem
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
  min,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  min?: string;
  step?: string;
}) {
  return (
    <label className="block text-[12px] text-zinc-500">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        min={min}
        step={step}
        className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 placeholder:text-zinc-600 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
      />
    </label>
  );
}
