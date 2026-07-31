"use client";

import { useState, useTransition } from "react";
import { updatePersonalityAction } from "@/app/actions/orchestrator";
import {
  PERSONALITY_LANGUAGES,
  PERSONALITY_TONES,
  type AuraPersonality,
  type CommunicationLanguage,
  type CommunicationTone,
} from "@/lib/orchestrator";

export function PersonalityControls({
  initial,
}: {
  initial: AuraPersonality;
}) {
  const [style, setStyle] = useState(initial.style);
  const [tone, setTone] = useState<CommunicationTone>(initial.tone);
  const [language, setLanguage] = useState<CommunicationLanguage>(
    initial.language
  );
  const [objectives, setObjectives] = useState(initial.objectives.join("\n"));
  const [preferences, setPreferences] = useState(
    initial.preferences.join("\n")
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const result = await updatePersonalityAction({
        style,
        tone,
        language,
        objectives: objectives
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        preferences: preferences
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setMessage(result.error ? result.error : "Personalidade atualizada.");
    });
  }

  return (
    <div className="space-y-3" data-testid="aura-personality-controls">
      <label className="block space-y-1">
        <span className="text-[11px] text-zinc-500">Estilo de comunicação</span>
        <input
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] text-zinc-100"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-[11px] text-zinc-500">Tom</span>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as CommunicationTone)}
            className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] text-zinc-100"
          >
            {PERSONALITY_TONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] text-zinc-500">Idioma</span>
          <select
            value={language}
            onChange={(e) =>
              setLanguage(e.target.value as CommunicationLanguage)
            }
            className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] text-zinc-100"
          >
            {PERSONALITY_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-[11px] text-zinc-500">
          Objetivos (um por linha)
        </span>
        <textarea
          value={objectives}
          onChange={(e) => setObjectives(e.target.value)}
          rows={3}
          className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] text-zinc-100"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] text-zinc-500">
          Preferências (um por linha)
        </span>
        <textarea
          value={preferences}
          onChange={(e) => setPreferences(e.target.value)}
          rows={3}
          className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-[13px] text-zinc-100"
        />
      </label>
      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="rounded border border-cyan-500/30 px-3 py-1.5 text-[12px] text-cyan-100 disabled:opacity-50"
      >
        {pending ? "Salvando…" : "Salvar personalidade"}
      </button>
      {message ? (
        <p className="text-[11px] text-zinc-500">{message}</p>
      ) : null}
      <p className="text-[10px] text-zinc-600">
        Não altera o Identity Engine — apenas preferências de comunicação do
        Orchestrator.
      </p>
    </div>
  );
}
