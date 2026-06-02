"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import type { Cliente } from "@/types/database";
import { ORCAMENTO_STATUSES } from "@/utils/alvesz-integration";
import { calcLucroEstimado } from "@/utils/alvesz";
import { formatBRL } from "@/utils/format";

type AddOrcamentoModalProps = {
  open: boolean;
  onClose: () => void;
  clientes: Cliente[];
  onSubmit: (payload: {
    cliente_id: string | null;
    tipo_evento: string;
    convidados: number;
    valor_total: number;
    lucro_estimado: number;
    status: string;
    data_evento: string | null;
    local: string | null;
    criarLead: boolean;
  }) => Promise<{ error: string | null }>;
};

export function AddOrcamentoModal({
  open,
  onClose,
  clientes,
  onSubmit,
}: AddOrcamentoModalProps) {
  const [pending, setPending] = useState(false);
  const [valorTotal, setValorTotal] = useState(0);
  const [criarLead, setCriarLead] = useState(true);
  const lucro = calcLucroEstimado(valorTotal);

  useEffect(() => {
    if (!open) {
      setValorTotal(0);
      setCriarLead(true);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const cliente_id = String(fd.get("cliente_id") || "") || null;
    const tipo_evento = String(fd.get("tipo_evento")).trim();
    const convidados = Number(fd.get("convidados"));
    const valor_total = Number(fd.get("valor_total"));
    const dataRaw = String(fd.get("data_evento") ?? "");

    if (!tipo_evento || !convidados || !valor_total) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setPending(true);
    const { error } = await onSubmit({
      cliente_id,
      tipo_evento,
      convidados,
      valor_total,
      lucro_estimado: calcLucroEstimado(valor_total),
      status: String(fd.get("status") ?? "rascunho"),
      data_evento: dataRaw || null,
      local: String(fd.get("local") ?? "").trim() || null,
      criarLead,
    });
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Orçamento criado.");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo orçamento"
      description="Lucro estimado calculado com margem de 38%."
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-[12px] text-zinc-500">
          Cliente
          <select
            name="cliente_id"
            className="mt-1 h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px] text-zinc-200 focus:outline-none"
          >
            <option value="">Sem cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id} className="bg-zinc-900">
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <Field label="Tipo de evento" name="tipo_evento" placeholder="Premium Open Bar" required />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Convidados" name="convidados" type="number" min="1" required />
          <Field
            label="Valor total (R$)"
            name="valor_total"
            type="number"
            min="0"
            step="0.01"
            required
            value={valorTotal || ""}
            onChange={(e) => setValorTotal(Number(e.target.value) || 0)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Data do evento" name="data_evento" type="date" />
          <label className="block text-[12px] text-zinc-500">
            Status
            <select
              name="status"
              defaultValue="rascunho"
              className="mt-1 h-9 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-2 text-[13px] text-zinc-200 focus:outline-none"
            >
              {ORCAMENTO_STATUSES.map((s) => (
                <option key={s.id} value={s.id} className="bg-zinc-900">
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Field label="Local" name="local" placeholder="Salão, chácara..." />
        <div className="rounded-md bg-violet-500/10 px-3 py-2 text-[12px]">
          <span className="text-zinc-500">Lucro estimado: </span>
          <span className="font-medium text-violet-200">{formatBRL(lucro)}</span>
        </div>
        <label className="flex items-center gap-2 text-[12px] text-zinc-400">
          <input
            type="checkbox"
            checked={criarLead}
            onChange={(e) => setCriarLead(e.target.checked)}
            className="rounded border-white/20"
          />
          Criar lead no Crescimento Digital
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-[13px] font-medium transition-colors hover:bg-white/[0.1] disabled:opacity-50"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          Criar orçamento
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
