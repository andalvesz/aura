"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "aura-brain-onboarding-v1";

const STEPS = [
  {
    title: "O que registrar como memória",
    body: "Anote fatos, preferências e eventos importantes. Quanto mais claro, melhor o Aura conecta ideias.",
  },
  {
    title: "Privada vs compartilhada",
    body: "Memórias privadas ficam só com você. Compartilhadas no workspace ajudam o time a ver o mesmo contexto — só compartilhe de propósito.",
  },
  {
    title: "Atualizar descobertas",
    body: "Use “Atualizar descobertas” quando quiser revisar sinais novos. Não há execução automática.",
  },
  {
    title: "Como ler a confiança",
    body: "Confiança alta = mais evidências. Baixa = indício fraco. Sempre trate como hipótese.",
  },
  {
    title: "Tipos de sinal",
    body: "Oportunidade (pode valer uma revisão), Risco (merece atenção), Lacuna (faltam informações), Desconhecido (ainda não dá para concluir).",
  },
  {
    title: "Confirmar ou rejeitar",
    body: "Confirme se o sinal faz sentido; rejeite ou silencie se não. Isso não vira tarefa nem ação automática.",
  },
] as const;

export function AuraBrainOnboarding({
  forceOpen = false,
}: {
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(forceOpen);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) return;
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [forceOpen]);

  if (!open) {
    return (
      <button
        type="button"
        className="text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        onClick={() => {
          setStep(0);
          setOpen(true);
        }}
        data-testid="aura-onboarding-reopen"
      >
        Como usar o Aura Brain
      </button>
    );
  }

  const current = STEPS[step];
  const last = step >= STEPS.length - 1;

  return (
    <section
      className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-4"
      data-testid="aura-brain-onboarding"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-400/80">
        Primeiros passos · {step + 1}/{STEPS.length}
      </p>
      <h2 className="mt-1 text-[15px] text-zinc-100">{current.title}</h2>
      <p className="mt-1 text-[13px] text-zinc-400">{current.body}</p>
      <p className="mt-3 text-[12px] text-zinc-500">
        O Aura ainda não executa decisões — só organiza indícios para você revisar.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!last ? (
          <button
            type="button"
            className="rounded border border-cyan-500/40 px-3 py-1.5 text-[12px] text-cyan-100 hover:bg-cyan-500/10"
            onClick={() => setStep((s) => s + 1)}
          >
            Próximo
          </button>
        ) : (
          <button
            type="button"
            className="rounded border border-emerald-500/40 px-3 py-1.5 text-[12px] text-emerald-100 hover:bg-emerald-500/10"
            data-testid="aura-onboarding-done"
            onClick={() => {
              try {
                localStorage.setItem(STORAGE_KEY, "1");
              } catch {
                /* ignore */
              }
              setOpen(false);
            }}
          >
            Entendi
          </button>
        )}
        <Link
          href="/dashboard/settings/memory"
          className="text-[12px] text-zinc-500 hover:text-zinc-300"
        >
          Registrar uma memória
        </Link>
        <button
          type="button"
          className="ml-auto text-[11px] text-zinc-600 hover:text-zinc-400"
          onClick={() => {
            try {
              localStorage.setItem(STORAGE_KEY, "1");
            } catch {
              /* ignore */
            }
            setOpen(false);
          }}
        >
          Pular
        </button>
      </div>
    </section>
  );
}
