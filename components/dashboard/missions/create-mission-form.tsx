"use client";

import { useState, useTransition } from "react";
import { createMission } from "@/app/actions/missions";
import type { MissionType } from "@/lib/missions/mission-types";

const TYPES: { value: MissionType; label: string }[] = [
  { value: "PERSONAL", label: "Pessoal" },
  { value: "BUSINESS", label: "Negócios" },
  { value: "LEARNING", label: "Aprendizado" },
  { value: "HEALTH", label: "Saúde" },
  { value: "FINANCIAL", label: "Financeiro" },
  { value: "TRAVEL", label: "Viagem" },
  { value: "CUSTOM", label: "Custom" },
];

export function CreateMissionForm() {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MissionType>("PERSONAL");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      data-testid="create-mission-form"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const res = await createMission({
            title,
            type,
            description: description || undefined,
          });
          if (res.error) {
            setError(res.error);
            return;
          }
          setTitle("");
          setDescription("");
        });
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-[11px] text-zinc-500">Título</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Disney, Abrir empresa, Aprender inglês"
            className="w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-[13px] text-zinc-100 outline-none focus:border-zinc-500"
            data-testid="mission-title-input"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] text-zinc-500">Tipo</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MissionType)}
            className="w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-[13px] text-zinc-100 outline-none focus:border-zinc-500"
            data-testid="mission-type-select"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-[11px] text-zinc-500">Descrição (opcional)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-[13px] text-zinc-100 outline-none focus:border-zinc-500"
        />
      </label>
      {error ? (
        <p className="text-[12px] text-rose-400" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-100 px-3 py-2 text-[12px] font-medium text-zinc-900 transition hover:bg-white disabled:opacity-50"
        data-testid="mission-create-submit"
      >
        {pending ? "Planejando…" : "Criar missão"}
      </button>
    </form>
  );
}
