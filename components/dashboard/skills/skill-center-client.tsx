"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  disableSkillPure,
  enableSkillPure,
  getPlatformState,
  installSkillPure,
  previewSkillInstall,
  resolveSkills,
  setPlatformState,
  skillCenterSections,
  uninstallSkillPure,
  updateSkillConfigPure,
  type ResolveContext,
} from "@/lib/capabilities";

type Props = {
  userId: string;
  workspaceId: string | null;
  workspaceSlug: string | null;
  role: ResolveContext["role"];
  isWorkspaceMember: boolean;
};

export function SkillCenterClient(props: Props) {
  const ctx: ResolveContext = {
    userId: props.userId,
    workspaceId: props.workspaceId,
    workspaceSlug: props.workspaceSlug,
    role: props.role,
    isWorkspaceMember: props.isWorkspaceMember,
  };
  const [, bump] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [configText, setConfigText] = useState("{}");
  const [message, setMessage] = useState<string | null>(null);
  const [step, setStep] = useState<
    null | "caps" | "perms" | "risk" | "deps" | "confirm" | "config"
  >(null);

  const sections = useMemo(() => {
    const resolved = resolveSkills(getPlatformState(), ctx);
    return skillCenterSections(resolved);
  }, [ctx.userId, ctx.workspaceId, ctx.workspaceSlug, bump]);

  const preview = selected
    ? previewSkillInstall(getPlatformState(), selected, ctx)
    : null;

  function refresh() {
    bump((n) => n + 1);
  }

  function runInstall(activate: boolean) {
    if (!selected) return;
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(configText) as Record<string, unknown>;
    } catch {
      setMessage("Config JSON inválido");
      return;
    }
    const res = installSkillPure(getPlatformState(), selected, ctx, {
      config,
      activate,
    });
    setPlatformState(res.state);
    setMessage(
      res.ok
        ? activate
          ? "Skill instalada e ativada"
          : "Skill instalada"
        : res.issues.map((i) => i.message).join("; ")
    );
    setStep(null);
    refresh();
  }

  function Section({
    title,
    items,
  }: {
    title: string;
    items: typeof sections.installed;
  }) {
    return (
      <section className="space-y-2" data-testid={`skills-section-${title}`}>
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          {title} ({items.length})
        </h2>
        <ul className="space-y-1.5">
          {items.map((s) => (
            <li key={s.definition.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(s.definition.id);
                  setConfigText(JSON.stringify(s.definition.defaultConfig, null, 2));
                  setStep(null);
                }}
                className={`w-full rounded-lg border px-3 py-2 text-left text-[13px] ${
                  selected === s.definition.id
                    ? "border-cyan-500/40 bg-cyan-500/5 text-zinc-100"
                    : "border-white/[0.06] bg-zinc-950/40 text-zinc-300 hover:border-white/10"
                }`}
              >
                <span className="font-medium">{s.definition.name}</span>
                <span className="mt-0.5 block text-[11px] text-zinc-500">
                  {s.definition.description} · v{s.definition.version} ·{" "}
                  {s.status}
                </span>
              </button>
            </li>
          ))}
          {!items.length ? (
            <li className="text-[12px] text-zinc-600">Nenhum item</li>
          ) : null}
        </ul>
      </section>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]" data-testid="skill-center">
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-medium text-zinc-100">Skill Center</h1>
          <p className="text-[12px] text-zinc-500">
            Instale e configure habilidades do Aura — sem marketplace público.
          </p>
        </div>
        {message ? (
          <p className="rounded-md border border-white/[0.06] px-3 py-2 text-[12px] text-zinc-300">
            {message}
          </p>
        ) : null}
        <Section title="Instaladas" items={sections.installed} />
        <Section title="Disponíveis" items={sections.available} />
        <Section title="Ativas" items={sections.active} />
        <Section title="Desativadas" items={sections.disabled} />
        <Section title="Privadas" items={sections.private} />
        <Section title="Do workspace" items={sections.workspace} />
        <Section title="Dependências pendentes" items={sections.pendingDependencies} />
        <Section title="Com erro" items={sections.error} />
      </div>

      <aside className="space-y-3 rounded-lg border border-white/[0.06] bg-zinc-950/50 p-4">
        {!selected || !preview?.skill ? (
          <p className="text-[12px] text-zinc-500">Selecione uma skill</p>
        ) : (
          <>
            <h2 className="text-[14px] font-medium text-zinc-100">
              {preview.skill.name}
            </h2>
            <p className="text-[12px] text-zinc-500">{preview.skill.description}</p>
            <p className="text-[11px] text-zinc-600">
              Risco: {preview.riskLevel} · Visibilidade: {preview.skill.visibility}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-zinc-300"
                onClick={() => setStep("caps")}
              >
                Capacidades
              </button>
              <button
                type="button"
                className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-zinc-300"
                onClick={() => setStep("perms")}
              >
                Permissões
              </button>
              <button
                type="button"
                className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-zinc-300"
                onClick={() => setStep("risk")}
              >
                Riscos
              </button>
              <button
                type="button"
                className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-zinc-300"
                onClick={() => setStep("deps")}
              >
                Dependências
              </button>
              <Link
                href={preview.skill.documentation}
                className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-cyan-400"
              >
                Docs
              </Link>
            </div>
            {step === "caps" ? (
              <ul className="text-[11px] text-zinc-400">
                {preview.capabilities.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            ) : null}
            {step === "perms" ? (
              <ul className="text-[11px] text-zinc-400">
                {(preview.permissions ?? []).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : null}
            {step === "risk" ? (
              <p className="text-[11px] text-zinc-400">Nível: {preview.riskLevel}</p>
            ) : null}
            {step === "deps" ? (
              <ul className="text-[11px] text-zinc-400">
                {preview.issues.length
                  ? preview.issues.map((i, idx) => (
                      <li key={idx}>
                        {i.code}: {i.message}
                      </li>
                    ))
                  : "Dependências OK"}
              </ul>
            ) : null}
            {step === "config" || step === "confirm" ? (
              <textarea
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
                className="h-28 w-full rounded-md border border-white/10 bg-black/40 p-2 font-mono text-[11px] text-zinc-300"
              />
            ) : null}
            <div className="flex flex-col gap-1.5 pt-2">
              <button
                type="button"
                className="rounded-md bg-cyan-600/80 px-3 py-1.5 text-[12px] text-white"
                onClick={() => {
                  setStep("confirm");
                  runInstall(true);
                }}
              >
                Instalar e ativar
              </button>
              <button
                type="button"
                className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-zinc-300"
                onClick={() => {
                  const res = enableSkillPure(getPlatformState(), selected, ctx);
                  setPlatformState(res.state);
                  setMessage(res.ok ? "Ativada" : res.issues.map((i) => i.message).join("; "));
                  refresh();
                }}
              >
                Ativar
              </button>
              <button
                type="button"
                className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-zinc-300"
                onClick={() => {
                  const res = disableSkillPure(getPlatformState(), selected, ctx);
                  setPlatformState(res.state);
                  setMessage(res.ok ? "Desativada" : res.issues.map((i) => i.message).join("; "));
                  refresh();
                }}
              >
                Desativar
              </button>
              <button
                type="button"
                className="rounded-md border border-white/10 px-3 py-1.5 text-[12px] text-zinc-300"
                onClick={() => {
                  setStep("config");
                  try {
                    const config = JSON.parse(configText) as Record<string, unknown>;
                    const res = updateSkillConfigPure(
                      getPlatformState(),
                      selected,
                      ctx,
                      config
                    );
                    setPlatformState(res.state);
                    setMessage(res.ok ? "Config salva" : res.issues.map((i) => i.message).join("; "));
                    refresh();
                  } catch {
                    setMessage("JSON inválido");
                  }
                }}
              >
                Configurar
              </button>
              <button
                type="button"
                className="rounded-md border border-rose-500/30 px-3 py-1.5 text-[12px] text-rose-300"
                onClick={() => {
                  const res = uninstallSkillPure(getPlatformState(), selected, ctx);
                  setPlatformState(res.state);
                  setMessage(res.ok ? "Removida" : res.issues.map((i) => i.message).join("; "));
                  refresh();
                }}
              >
                Remover
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
