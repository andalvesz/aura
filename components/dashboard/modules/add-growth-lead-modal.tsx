"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import type { GrowthLeadCanal, GrowthLeadStatus, GrowthVertical } from "@/types/database";
import {
  GROWTH_LEAD_CANAIS,
  GROWTH_LEAD_STATUSES,
  SALES_VERTICALS,
} from "@/utils/growth";

export type GrowthLeadFormPayload = {
  nome: string;
  contato: string;
  origem: string;
  canal: GrowthLeadCanal;
  vertical: GrowthVertical | null;
  status: GrowthLeadStatus;
  valor_potencial: number;
  observacoes: string;
};

type AddGrowthLeadModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: GrowthLeadFormPayload) => Promise<{ error: string | null }>;
};

export function AddGrowthLeadModal({ open, onClose, onSubmit }: AddGrowthLeadModalProps) {
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome")).trim();
    if (!nome) {
      toast.error("Informe o nome do lead.");
      return;
    }

    const valorRaw = String(fd.get("valor_potencial") ?? "0").replace(",", ".");
    const valor_potencial = Math.max(0, Number.parseFloat(valorRaw) || 0);

    const verticalRaw = String(fd.get("vertical") ?? "");
    const vertical =
      verticalRaw === "alvesz" ||
      verticalRaw === "consorcios" ||
      verticalRaw === "marca_pessoal"
        ? verticalRaw
        : null;

    setPending(true);
    const { error } = await onSubmit({
      nome,
      contato: String(fd.get("contato") ?? "").trim(),
      origem: String(fd.get("origem") ?? "").trim() || "outro",
      canal: String(fd.get("canal") ?? "outro") as GrowthLeadCanal,
      vertical,
      status: String(fd.get("status") ?? "novo") as GrowthLeadStatus,
      valor_potencial,
      observacoes: String(fd.get("observacoes") ?? "").trim(),
    });
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Lead cadastrado.");
    onClose();
    e.currentTarget.reset();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo lead comercial"
      description="Cadastre um lead no CRM do Crescimento Digital."
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Nome" name="nome" required />
        <Field label="Contato (telefone / WhatsApp)" name="contato" placeholder="(11) 99999-0000" />
        <label className="block text-[12px] text-zinc-500">
          Canal
          <select
            name="canal"
            defaultValue="outro"
            className="mt-1 h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px] text-zinc-200"
          >
            {GROWTH_LEAD_CANAIS.map((c) => (
              <option key={c.value} value={c.value} className="bg-zinc-900">
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <Field label="Origem (detalhe)" name="origem" placeholder="Evento, DM, indicação..." />
        <label className="block text-[12px] text-zinc-500">
          Vertical
          <select
            name="vertical"
            defaultValue=""
            className="mt-1 h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px] text-zinc-200"
          >
            <option value="" className="bg-zinc-900">
              Não definido
            </option>
            {SALES_VERTICALS.map((v) => (
              <option key={v.id} value={v.id} className="bg-zinc-900">
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Valor potencial (R$)"
          name="valor_potencial"
          type="number"
          min={0}
          step="0.01"
          placeholder="0"
        />
        <label className="block text-[12px] text-zinc-500">
          Status
          <select
            name="status"
            defaultValue="novo"
            className="mt-1 h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px] text-zinc-200"
          >
            {GROWTH_LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value} className="bg-zinc-900">
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[12px] text-zinc-500">
          Observações
          <textarea
            name="observacoes"
            rows={2}
            className="mt-1 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-[13px] text-zinc-200 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-[13px] font-medium disabled:opacity-50"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          Salvar lead
        </button>
      </form>
    </Modal>
  );
}

function Field({
  label,
  name,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-[12px] text-zinc-500">
      {label}
      <input
        name={name}
        className="mt-1 h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px] text-zinc-200 focus:outline-none"
        {...props}
      />
    </label>
  );
}
