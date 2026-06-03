"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { formatBRL } from "@/utils/format";
import { resetHtmlForm } from "@/utils/html-form";

type SetSaldoInicialModalProps = {
  open: boolean;
  onClose: () => void;
  currentValue?: number | null;
  onSubmit: (valor: number) => Promise<{ error: string | null }>;
};

export function SetSaldoInicialModal({
  open,
  onClose,
  currentValue,
  onSubmit,
}: SetSaldoInicialModalProps) {
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const valor = Number(fd.get("valor_atual"));

    if (!valor || valor < 0) {
      toast.error("Informe um valor válido.");
      return;
    }

    setPending(true);
    const { error } = await onSubmit(valor);
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Saldo inicial salvo.");
    resetHtmlForm(form);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Definir saldo inicial"
      description="Informe quanto você tem disponível hoje. O saldo atual considera receitas e gastos do mês."
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {currentValue != null && currentValue > 0 && (
          <p className="text-[11px] text-zinc-500">
            Valor atual cadastrado: {formatBRL(currentValue)}
          </p>
        )}
        <label className="block text-[12px] text-zinc-500">
          Quanto você tem hoje (R$)
          <input
            name="valor_atual"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="0,00"
            className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 placeholder:text-zinc-600 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-base font-medium text-zinc-100 transition-colors hover:bg-white/[0.1] disabled:opacity-50 md:min-h-9 md:h-9 md:text-[13px]"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          Salvar saldo
        </button>
      </form>
    </Modal>
  );
}
