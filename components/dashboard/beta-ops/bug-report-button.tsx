"use client";

import { useState, useTransition } from "react";
import { submitFeedbackAction } from "@/app/actions/beta-ops";

type Props = {
  route?: string;
  lastErrorCode?: string | null;
};

export function BugReportButton({ route, lastErrorCode }: Props) {
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const res = await submitFeedbackAction({
        title: title || "Problema reportado",
        description,
        type: "BUG",
        route: route ?? (typeof window !== "undefined" ? window.location.pathname : null),
        consentBugReport: consent,
        browserMetadata: consent
          ? {
              userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : "",
              language: typeof navigator !== "undefined" ? navigator.language : "",
            }
          : {},
        deviceMetadata: consent
          ? {
              viewport:
                typeof window !== "undefined"
                  ? `${window.innerWidth}x${window.innerHeight}`
                  : "",
            }
          : {},
        lastErrorCode: lastErrorCode ?? null,
        appVersion: "10.2.0-beta",
        activeFeatureFlags: [],
      });
      if (!res.ok) {
        setMsg(res.error ?? "Falha");
        return;
      }
      setMsg(`Enviado. Correlation: ${res.correlationId ?? "—"}`);
      setOpen(false);
      setTitle("");
      setDescription("");
    });
  }

  return (
    <div className="relative" data-testid="bug-report">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-white/[0.08] px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200"
        data-testid="bug-report-button"
      >
        Reportar problema
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 space-y-2 rounded-md border border-white/[0.1] bg-zinc-950 p-3 shadow-xl">
          <p className="text-[12px] font-medium text-zinc-200">Reportar problema</p>
          <input
            className="w-full rounded border border-white/[0.08] bg-zinc-900 px-2 py-1 text-[12px] text-zinc-100"
            placeholder="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="bug-report-title"
          />
          <textarea
            className="h-20 w-full rounded border border-white/[0.08] bg-zinc-900 px-2 py-1 text-[12px] text-zinc-100"
            placeholder="Descrição (sem senhas, tokens ou conteúdo privado)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            data-testid="bug-report-description"
          />
          <label className="flex items-start gap-2 text-[11px] text-zinc-400">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              data-testid="bug-report-consent"
            />
            Autorizo capturar rota, horário, navegador, dispositivo, versão e correlationId (sem
            conteúdo privado).
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="text-[11px] text-zinc-500"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending || !description.trim()}
              onClick={submit}
              className="rounded bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-900 disabled:opacity-40"
              data-testid="bug-report-submit"
            >
              Enviar
            </button>
          </div>
          {msg && <p className="text-[11px] text-zinc-500">{msg}</p>}
        </div>
      )}
    </div>
  );
}
