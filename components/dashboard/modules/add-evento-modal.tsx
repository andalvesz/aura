"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import type { Evento, GrowthLead } from "@/types/database";
import { FORM_GRID_2_CLASS } from "@/utils/dashboard-mobile";
import {
  buildEventoDateTime,
  EVENTO_TIPOS,
  splitEventoDateTime,
  type ParsedEventoSuggestion,
} from "@/utils/calendar";

type EventoPayload = {
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  local: string | null;
  tipo: string;
  growth_lead_id: string | null;
};

type AddEventoModalProps = {
  open: boolean;
  onClose: () => void;
  leads?: GrowthLead[];
  initial?: Evento | ParsedEventoSuggestion | null;
  onSubmit: (payload: EventoPayload) => Promise<{ error: string | null }>;
};

export function AddEventoModal({
  open,
  onClose,
  leads = [],
  initial,
  onSubmit,
}: AddEventoModalProps) {
  const [pending, setPending] = useState(false);
  const isEdit = initial && "id" in initial;
  const today = new Date().toISOString().slice(0, 10);

  const defaults = (() => {
    if (!initial) {
      return { titulo: "", descricao: "", data: today, hora: "09:00", tipo: "geral", lead: "" };
    }
    if ("id" in initial) {
      const { data, hora } = splitEventoDateTime(initial.data_inicio);
      return {
        titulo: initial.titulo,
        descricao: initial.descricao ?? "",
        data,
        hora,
        tipo: initial.tipo,
        lead: initial.growth_lead_id ?? "",
      };
    }
    return {
      titulo: initial.titulo,
      descricao: initial.descricao ?? "",
      data: initial.data,
      hora: initial.hora,
      tipo: initial.tipo,
      lead: "",
    };
  })();

  const [titulo, setTitulo] = useState(defaults.titulo);
  const [descricao, setDescricao] = useState(defaults.descricao);
  const [data, setData] = useState(defaults.data);
  const [hora, setHora] = useState(defaults.hora);
  const [tipo, setTipo] = useState(defaults.tipo);
  const [leadId, setLeadId] = useState(defaults.lead);

  useEffect(() => {
    if (!open) return;
    setTitulo(defaults.titulo);
    setDescricao(defaults.descricao);
    setData(defaults.data);
    setHora(defaults.hora);
    setTipo(defaults.tipo);
    setLeadId(defaults.lead);
  }, [open, initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || !data) {
      toast.error("Preencha título e data.");
      return;
    }

    setPending(true);
    const { error } = await onSubmit({
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      data_inicio: buildEventoDateTime(data, hora),
      local: null,
      tipo,
      growth_lead_id: leadId || null,
    });
    setPending(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(isEdit ? "Evento atualizado." : "Evento criado.");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar evento" : "Novo evento"}
      description="Compromisso na sua agenda Aura."
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Título" value={titulo} onChange={setTitulo} required />
        <Field
          label="Descrição"
          value={descricao}
          onChange={setDescricao}
          placeholder="Opcional"
        />
        <div className={FORM_GRID_2_CLASS}>
          <label className="block text-[12px] text-zinc-500">
            Data
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              required
              className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
            />
          </label>
          <label className="block text-[12px] text-zinc-500">
            Horário
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              required
              className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
            />
          </label>
        </div>
        <label className="block text-[12px] text-zinc-500">
          Tipo
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
          >
            {EVENTO_TIPOS.map((t) => (
              <option key={t.id} value={t.id} className="bg-zinc-900">
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {leads.length > 0 && (
          <label className="block text-[12px] text-zinc-500">
            Lead relacionado (opcional)
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
            >
              <option value="">Nenhum</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id} className="bg-zinc-900">
                  {l.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="submit"
          disabled={pending}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.06] text-[13px] font-medium transition-colors hover:bg-white/[0.1] disabled:opacity-50"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          {isEdit ? "Salvar" : "Criar evento"}
        </button>
      </form>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block text-[12px] text-zinc-500">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="mt-1 min-h-11 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-base text-zinc-200 focus:border-white/[0.15] focus:outline-none md:min-h-9 md:h-9 md:px-2 md:text-[13px]"
      />
    </label>
  );
}
