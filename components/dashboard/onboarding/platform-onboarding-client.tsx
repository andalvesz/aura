"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import {
  completePersonalOnboardingPure,
  suggestFromOnboarding,
  ensurePlatformRegistries,
  getPlatformState,
  setPlatformState,
  type OnboardingAnswers,
  type ResolveContext,
  type PlatformRole,
} from "@/lib/capabilities";

const AREA_OPTIONS: { id: string; label: string }[] = [
  { id: "finance", label: "Finanças" },
  { id: "health", label: "Saúde" },
  { id: "projects", label: "Projetos" },
  { id: "knowledge", label: "Conhecimento" },
  { id: "business", label: "Negócios" },
  { id: "missions", label: "Missões" },
  { id: "content", label: "Conteúdo" },
  { id: "travel", label: "Viagens" },
  { id: "languages", label: "Idiomas" },
  { id: "creator", label: "Creator" },
];

type PlatformOnboardingClientProps = {
  userId: string;
  role?: PlatformRole;
};

function buildCtx(userId: string, role?: PlatformRole): ResolveContext {
  return {
    userId,
    workspaceId: null,
    workspaceSlug: null,
    role: role ?? "owner",
    isWorkspaceMember: false,
  };
}

export function PlatformOnboardingClient({ userId, role }: PlatformOnboardingClientProps) {
  const ctx = useMemo(() => buildCtx(userId, role), [userId, role]);
  const [primaryGoal, setPrimaryGoal] = useState("");
  const [usageType, setUsageType] = useState<OnboardingAnswers["usageType"]>("personal");
  const [desiredAreas, setDesiredAreas] = useState<string[]>([]);
  const [workspaceSize, setWorkspaceSize] =
    useState<OnboardingAnswers["workspaceSize"]>("solo");
  const [automationLevel, setAutomationLevel] =
    useState<OnboardingAnswers["automationLevel"]>("low");
  const [language, setLanguage] = useState("pt-BR");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [installSuggestions, setInstallSuggestions] = useState(false);
  const [done, setDone] = useState<{
    suggestions: ReturnType<typeof suggestFromOnboarding>;
    experienceMode: string;
  } | null>(null);

  ensurePlatformRegistries();

  function toggleArea(id: string) {
    setDesiredAreas((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const answers: OnboardingAnswers = {
      primaryGoal,
      usageType,
      desiredAreas,
      workspaceSize,
      automationLevel,
      language,
      timezone,
    };
    const res = completePersonalOnboardingPure(getPlatformState(), ctx, answers, {
      installSuggestions,
    });
    setPlatformState(res.state);
    setDone({
      suggestions: res.suggestions,
      experienceMode: res.suggestions.experienceMode,
    });
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4" data-testid="platform-onboarding-done">
        <PageBreadcrumb
          items={[
            { label: "Meu Dia", href: "/dashboard" },
            { label: "Onboarding" },
          ]}
        />
        <h1 className="text-lg font-medium text-zinc-100">Onboarding concluído</h1>
        <p className="text-[12px] text-zinc-500">Modo: {done.experienceMode}</p>
        <section className="rounded-lg border border-white/[0.06] p-3">
          <h2 className="text-[13px] text-zinc-200">Skills sugeridas</h2>
          <ul className="mt-2 text-[11px] text-zinc-500">
            {done.suggestions.skills.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border border-white/[0.06] p-3">
          <h2 className="text-[13px] text-zinc-200">Módulos sugeridos</h2>
          <ul className="mt-2 text-[11px] text-zinc-500">
            {done.suggestions.modules.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>
        <Link
          href="/dashboard/skills"
          className="inline-block rounded border border-cyan-500/30 px-3 py-1.5 text-[12px] text-cyan-100"
        >
          Abrir Skill Center
        </Link>
      </div>
    );
  }

  return (
    <form
      className="mx-auto max-w-2xl space-y-4 p-4"
      data-testid="platform-onboarding"
      onSubmit={submit}
    >
      <PageBreadcrumb
        items={[
          { label: "Meu Dia", href: "/dashboard" },
          { label: "Onboarding plataforma" },
        ]}
      />
      <header>
        <h1 className="text-lg font-medium text-zinc-100">Onboarding da plataforma</h1>
        <p className="text-[12px] text-zinc-500">
          Personalize módulos e skills sugeridas — sem instalação automática.
        </p>
      </header>

      <label className="block space-y-1">
        <span className="text-[12px] text-zinc-400">Objetivo principal</span>
        <input
          className="w-full rounded border border-white/[0.06] bg-zinc-950/80 px-3 py-2 text-[13px] text-zinc-100"
          value={primaryGoal}
          onChange={(e) => setPrimaryGoal(e.target.value)}
          required
          data-testid="onboarding-primary-goal"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[12px] text-zinc-400">Tipo de uso</span>
        <select
          className="w-full rounded border border-white/[0.06] bg-zinc-950/80 px-3 py-2 text-[13px] text-zinc-100"
          value={usageType}
          onChange={(e) =>
            setUsageType(e.target.value as OnboardingAnswers["usageType"])
          }
        >
          <option value="personal">Pessoal</option>
          <option value="business">Negócios</option>
          <option value="both">Ambos</option>
        </select>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-[12px] text-zinc-400">Áreas desejadas</legend>
        <div className="flex flex-wrap gap-2">
          {AREA_OPTIONS.map((a) => (
            <label
              key={a.id}
              className="flex cursor-pointer items-center gap-1.5 rounded border border-white/[0.06] px-2 py-1 text-[11px] text-zinc-400"
            >
              <input
                type="checkbox"
                checked={desiredAreas.includes(a.id)}
                onChange={() => toggleArea(a.id)}
              />
              {a.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block space-y-1">
        <span className="text-[12px] text-zinc-400">Tamanho do workspace</span>
        <select
          className="w-full rounded border border-white/[0.06] bg-zinc-950/80 px-3 py-2 text-[13px] text-zinc-100"
          value={workspaceSize}
          onChange={(e) =>
            setWorkspaceSize(e.target.value as OnboardingAnswers["workspaceSize"])
          }
        >
          <option value="solo">Solo</option>
          <option value="small">Pequeno</option>
          <option value="medium">Médio</option>
          <option value="large">Grande</option>
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-[12px] text-zinc-400">Nível de automação desejado</span>
        <select
          className="w-full rounded border border-white/[0.06] bg-zinc-950/80 px-3 py-2 text-[13px] text-zinc-100"
          value={automationLevel}
          onChange={(e) =>
            setAutomationLevel(e.target.value as OnboardingAnswers["automationLevel"])
          }
        >
          <option value="low">Baixo</option>
          <option value="medium">Médio</option>
          <option value="high">Alto (ainda revisável)</option>
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-[12px] text-zinc-400">Idioma</span>
          <input
            className="w-full rounded border border-white/[0.06] bg-zinc-950/80 px-3 py-2 text-[13px] text-zinc-100"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[12px] text-zinc-400">Fuso horário</span>
          <input
            className="w-full rounded border border-white/[0.06] bg-zinc-950/80 px-3 py-2 text-[13px] text-zinc-100"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-[12px] text-zinc-400">
        <input
          type="checkbox"
          checked={installSuggestions}
          onChange={(e) => setInstallSuggestions(e.target.checked)}
          data-testid="onboarding-install-suggestions"
        />
        Instalar sugestões após concluir
      </label>

      <button
        type="submit"
        className="rounded border border-cyan-500/30 px-4 py-2 text-[13px] text-cyan-100"
      >
        Concluir onboarding
      </button>
    </form>
  );
}
