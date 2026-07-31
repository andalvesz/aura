"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import {
  ONBOARDING_V2_STEPS,
  createOnboardingV2Progress,
  firstValueActions,
  getExperiencePreset,
  EXPERIENCE_PRESETS,
  type OnboardingV2Progress,
  type ExperienceMode,
  type OnboardingAnswers,
} from "@/lib/capabilities";
import {
  advanceOnboardingAction,
  completeOnboardingAction,
} from "@/app/actions/platform";

type Props = {
  userId: string;
  initial?: OnboardingV2Progress | null;
};

export function OnboardingV2Client({ userId, initial }: Props) {
  const [progress, setProgress] = useState<OnboardingV2Progress>(
    initial ?? createOnboardingV2Progress()
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const stepMeta = ONBOARDING_V2_STEPS.find((s) => s.id === progress.step);

  const suggestions = useMemo(() => {
    const mode = progress.answers.experienceMode ?? "CUSTOM";
    return getExperiencePreset(mode);
  }, [progress.answers.experienceMode]);

  async function go(next: number, patch?: OnboardingV2Progress["answers"]) {
    setPending(true);
    const res = await advanceOnboardingAction({
      progress,
      nextStep: next,
      patch,
    });
    setPending(false);
    if (!res.ok) {
      setMessage(res.error ?? "Erro");
      // optimistic local for offline/memory
      setProgress((p) => ({
        ...p,
        step: next,
        answers: { ...p.answers, ...patch },
      }));
      return;
    }
    if (res.data) setProgress(res.data as OnboardingV2Progress);
    setMessage(null);
  }

  async function finish(install: boolean) {
    setPending(true);
    const res = await completeOnboardingAction({
      progress,
      installSelectedSkills: install,
    });
    setPending(false);
    if (!res.ok) {
      setMessage(res.error ?? "Erro ao concluir");
      return;
    }
    if (res.data) setProgress(res.data as OnboardingV2Progress);
    setMessage("Onboarding concluído. Sem dados fictícios. Autonomia AUTO_SAFE não foi ativada.");
  }

  if (progress.completed) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4" data-testid="onboarding-v2-done">
        <PageBreadcrumb
          items={[
            { label: "Meu Dia", href: "/dashboard" },
            { label: "Onboarding" },
          ]}
        />
        <h1 className="text-lg font-medium text-zinc-100">Pronto</h1>
        <p className="text-[12px] text-zinc-500">
          Checklist inicial — escolha uma primeira ação útil (sem demo automática).
        </p>
        <ul className="space-y-2">
          {firstValueActions().map((a) => (
            <li key={a.id}>
              <Link
                href={a.href}
                className="block rounded-lg border border-white/[0.06] px-3 py-2 text-[13px] text-zinc-200 hover:border-cyan-500/30"
              >
                {a.label}
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/dashboard" className="text-[12px] text-cyan-400">
          Ir para Aura Home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4" data-testid="onboarding-v2">
      <PageBreadcrumb
        items={[
          { label: "Meu Dia", href: "/dashboard" },
          { label: "Onboarding" },
        ]}
      />
      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">
          Etapa {progress.step} de 10 · {userId.slice(0, 8)}
        </p>
        <h1 className="text-lg font-medium text-zinc-100">{stepMeta?.title}</h1>
      </div>
      {message ? <p className="text-[12px] text-zinc-400">{message}</p> : null}

      {progress.step === 1 ? (
        <div className="space-y-3">
          <p className="text-[13px] text-zinc-400">
            Bem-vindo ao Aura Brain. Vamos configurar o essencial — você pode continuar depois.
          </p>
          <button
            type="button"
            disabled={pending}
            className="rounded-md bg-cyan-600/80 px-3 py-2 text-[13px] text-white"
            onClick={() => go(2)}
          >
            Começar
          </button>
        </div>
      ) : null}

      {progress.step === 2 ? (
        <div className="flex flex-col gap-2">
          {(["personal", "business", "both"] as const).map((u) => (
            <button
              key={u}
              type="button"
              className="rounded-lg border border-white/[0.06] px-3 py-2 text-left text-[13px] text-zinc-200"
              onClick={() => go(3, { usageType: u })}
            >
              {u === "personal" ? "Pessoal" : u === "business" ? "Empresarial" : "Ambos"}
            </button>
          ))}
        </div>
      ) : null}

      {progress.step === 3 ? (
        <div className="space-y-2">
          <input
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-zinc-100"
            placeholder="Objetivo principal"
            defaultValue={progress.answers.primaryGoal ?? ""}
            onBlur={(e) =>
              setProgress((p) => ({
                ...p,
                answers: { ...p.answers, primaryGoal: e.target.value },
              }))
            }
          />
          <button
            type="button"
            className="rounded-md bg-cyan-600/80 px-3 py-2 text-[13px] text-white"
            onClick={() =>
              go(4, {
                primaryGoal:
                  progress.answers.primaryGoal || "Organizar minha vida com o Aura",
              })
            }
          >
            Continuar
          </button>
        </div>
      ) : null}

      {progress.step === 4 ? (
        <div className="flex flex-col gap-2">
          {EXPERIENCE_PRESETS.map((p) => (
            <button
              key={p.mode}
              type="button"
              className="rounded-lg border border-white/[0.06] px-3 py-2 text-left text-[13px] text-zinc-200"
              onClick={() =>
                go(5, {
                  experienceMode: p.mode as ExperienceMode,
                  selectedSkillIds: p.suggestedSkillIds,
                })
              }
            >
              <span className="font-medium">{p.label}</span>
              <span className="mt-0.5 block text-[11px] text-zinc-500">{p.description}</span>
            </button>
          ))}
        </div>
      ) : null}

      {progress.step === 5 ? (
        <div className="space-y-2">
          <p className="text-[12px] text-zinc-500">Sugestões (não obrigatórias):</p>
          <ul className="text-[12px] text-zinc-300">
            {suggestions.suggestedSkillIds.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
          <button
            type="button"
            className="rounded-md bg-cyan-600/80 px-3 py-2 text-[13px] text-white"
            onClick={() => go(6)}
          >
            Continuar
          </button>
        </div>
      ) : null}

      {progress.step === 6 ? (
        <div className="flex flex-col gap-2">
          {(["low", "medium", "high"] as OnboardingAnswers["automationLevel"][]).map(
            (level) => (
              <button
                key={level}
                type="button"
                className="rounded-lg border border-white/[0.06] px-3 py-2 text-left text-[13px] text-zinc-200"
                onClick={() => go(7, { automationLevel: level })}
              >
                Automação {level}
                {level === "high" ? " (sem AUTO_SAFE automático)" : ""}
              </button>
            )
          )}
        </div>
      ) : null}

      {progress.step === 7 ? (
        <div className="space-y-2">
          <input
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[13px]"
            placeholder="Idioma (pt-BR)"
            defaultValue={progress.answers.language ?? "pt-BR"}
            onBlur={(e) =>
              setProgress((p) => ({
                ...p,
                answers: { ...p.answers, language: e.target.value },
              }))
            }
          />
          <input
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[13px]"
            placeholder="Timezone"
            defaultValue={progress.answers.timezone ?? "America/Sao_Paulo"}
            onBlur={(e) =>
              setProgress((p) => ({
                ...p,
                answers: { ...p.answers, timezone: e.target.value },
              }))
            }
          />
          <button
            type="button"
            className="rounded-md bg-cyan-600/80 px-3 py-2 text-[13px] text-white"
            onClick={() =>
              go(8, {
                language: progress.answers.language ?? "pt-BR",
                timezone: progress.answers.timezone ?? "America/Sao_Paulo",
              })
            }
          >
            Continuar
          </button>
        </div>
      ) : null}

      {progress.step === 8 ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="rounded-lg border border-white/[0.06] px-3 py-2 text-left text-[13px]"
            onClick={() => go(9, { workspaceChoice: "create" })}
          >
            Criar workspace depois em /dashboard/workspace
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/[0.06] px-3 py-2 text-left text-[13px]"
            onClick={() => go(9, { workspaceChoice: "skip" })}
          >
            Pular por agora (pessoal)
          </button>
        </div>
      ) : null}

      {progress.step === 9 ? (
        <div className="space-y-3 text-[12px] text-zinc-400">
          <p>Modo: {progress.answers.experienceMode ?? "CUSTOM"}</p>
          <p>Uso: {progress.answers.usageType ?? "—"}</p>
          <p>Objetivo: {progress.answers.primaryGoal ?? "—"}</p>
          <p>Skills: {(progress.answers.selectedSkillIds ?? []).join(", ") || "—"}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className="rounded-md bg-cyan-600/80 px-3 py-2 text-[13px] text-white"
              onClick={() => finish(true)}
            >
              Concluir e instalar skills sugeridas
            </button>
            <button
              type="button"
              disabled={pending}
              className="rounded-md border border-white/10 px-3 py-2 text-[13px] text-zinc-300"
              onClick={() => finish(false)}
            >
              Concluir sem instalar
            </button>
          </div>
        </div>
      ) : null}

      {progress.step > 1 && progress.step < 10 ? (
        <button
          type="button"
          className="text-[12px] text-zinc-500 underline"
          onClick={() => go(progress.step - 1)}
        >
          Voltar
        </button>
      ) : null}
    </div>
  );
}
