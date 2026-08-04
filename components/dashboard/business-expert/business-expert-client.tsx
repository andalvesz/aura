"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addBusinessObjective,
  addBusinessVenture,
  buildOverview,
  ensureBusinessExpertRegistered,
  ensureBusinessProfile,
  listBusinessModes,
  listDigitalBusinesses,
  listDomainIds,
  listKnowledgeArticles,
  listKnowledgeDomains,
  listKnowledgePacks,
  listLocalBusinesses,
  listMarketplaces,
  listObjectivesForUser,
  listSupportedBusinessTypes,
  listVenturesForUser,
  runAffiliateAssistant,
  runBusinessExpert,
  runLocalBusinessAdvisor,
  runProductBuilder,
  setBusinessMode,
  upsertBusinessProfile,
  validateBusinessIdea,
  type BusinessKnowledgeDomainId,
  type BusinessModeId,
  type CapitalBand,
  type ExperienceLevel,
  type LocalBusinessId,
  type SupportedBusinessType,
} from "@/lib/business-expert";

type TabId =
  | "overview"
  | "profile"
  | "areas"
  | "modes"
  | "marketplaces"
  | "objectives"
  | "businesses"
  | "tools"
  | "knowledge";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Visão geral" },
  { id: "profile", label: "Perfil" },
  { id: "modes", label: "Modos" },
  { id: "areas", label: "Áreas" },
  { id: "marketplaces", label: "Marketplaces" },
  { id: "objectives", label: "Objetivos" },
  { id: "businesses", label: "Negócios" },
  { id: "tools", label: "Assistentes" },
  { id: "knowledge", label: "Conhecimento" },
];

export function BusinessExpertClient({ userId }: { userId: string }) {
  const [tab, setTab] = useState<TabId>("overview");
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    ensureBusinessExpertRegistered();
    ensureBusinessProfile(userId);
    setTick((t) => t + 1);
  }, [userId]);

  const overview = useMemo(() => buildOverview(userId), [userId, tick]);
  const profile = useMemo(() => ensureBusinessProfile(userId), [userId, tick]);
  const sample = useMemo(
    () => runBusinessExpert({ userId, intent: "overview" }),
    [userId, tick]
  );

  return (
    <div className="space-y-4" data-testid="business-expert-page">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">
          Business Intelligence · B1.X Production
        </p>
        <h1 className="text-xl font-semibold text-zinc-100">Business Expert</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Consultor empresarial no Kernel Aura — validação, afiliados, produtos,
          negócios locais, marketplaces e planos (sem engines paralelos).
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/5 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded px-3 py-1.5 text-[12px] ${
              tab === t.id
                ? "bg-emerald-500/15 text-emerald-200"
                : "text-zinc-400 hover:bg-white/5"
            }`}
            data-testid={`be-tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <section className="space-y-3" data-testid="be-panel-overview">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Perfil" value={`${overview.profileCompleteness}%`} />
            <Stat label="Domínios" value={String(overview.domainCount)} />
            <Stat label="Marketplaces" value={String(overview.marketplaceCount)} />
            <Stat label="Packs" value={String(overview.packCount)} />
          </div>
          <div className="rounded-lg border border-white/10 bg-zinc-900/40 p-4 text-[12px] text-zinc-300">
            <p>{sample.advisor.summary}</p>
            <ul className="mt-2 space-y-1 text-zinc-400">
              {sample.opportunities.slice(0, 3).map((o) => (
                <li key={o.id}>· {o.title}</li>
              ))}
            </ul>
            <Link
              href="/dashboard/brain"
              className="mt-3 inline-block text-emerald-300 hover:underline"
            >
              Command Center →
            </Link>
          </div>
        </section>
      ) : null}

      {tab === "profile" ? (
        <ProfilePanel userId={userId} profile={profile} onSaved={refresh} />
      ) : null}

      {tab === "modes" ? (
        <section className="grid gap-3 sm:grid-cols-2" data-testid="be-panel-modes">
          {listBusinessModes().map((m) => (
            <article
              key={m.id}
              className="rounded-lg border border-white/10 bg-zinc-900/30 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-zinc-100">{m.name}</h3>
                <button
                  type="button"
                  className="text-[11px] text-emerald-300"
                  onClick={() => {
                    setBusinessMode(userId, m.id);
                    refresh();
                  }}
                >
                  Ativar
                </button>
              </div>
              <p className="mt-1 text-[12px] text-zinc-500">{m.summary}</p>
              <p className="mt-2 text-[11px] text-zinc-400">
                {m.firstMoves.join(" · ")}
              </p>
            </article>
          ))}
        </section>
      ) : null}

      {tab === "areas" ? (
        <section className="grid gap-3 sm:grid-cols-2" data-testid="be-panel-areas">
          {listKnowledgeDomains().map((d) => (
            <article
              key={d.id}
              className="rounded-lg border border-white/10 bg-zinc-900/30 p-3"
            >
              <h3 className="text-sm font-medium text-zinc-100">
                {d.name}
                {d.guidanceOnly ? (
                  <span className="ml-2 text-[10px] text-amber-300">orientação</span>
                ) : null}
              </h3>
              <p className="mt-1 text-[12px] text-zinc-500">{d.summary}</p>
            </article>
          ))}
        </section>
      ) : null}

      {tab === "marketplaces" ? (
        <section className="space-y-2" data-testid="be-panel-marketplaces">
          {listMarketplaces().map((m) => (
            <article
              key={m.id}
              className="rounded-lg border border-white/10 bg-zinc-900/30 p-3 text-[12px]"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-medium text-zinc-100">{m.name}</h3>
                <span className="text-[10px] text-zinc-500">{m.category}</span>
              </div>
              <p className="mt-1 text-zinc-500">{m.description}</p>
              <p className="mt-1 text-zinc-400">
                Checkout {m.checkout ? "✓" : "—"} · Recorrência{" "}
                {m.recurrence ? "✓" : "—"} · Afiliados {m.affiliates ? "✓" : "—"} ·
                API {m.api ? "✓" : "—"}
              </p>
              <p className="mt-1 text-[11px] text-amber-200/80">{m.guidanceNote}</p>
            </article>
          ))}
        </section>
      ) : null}

      {tab === "objectives" ? (
        <ObjectivesPanel
          userId={userId}
          objectives={listObjectivesForUser(userId)}
          onSaved={refresh}
        />
      ) : null}

      {tab === "businesses" ? (
        <BusinessesPanel
          userId={userId}
          ventures={listVenturesForUser(userId)}
          onSaved={refresh}
        />
      ) : null}

      {tab === "tools" ? <ToolsPanel userId={userId} onSaved={refresh} /> : null}

      {tab === "knowledge" ? (
        <section className="space-y-3" data-testid="be-panel-knowledge">
          <p className="text-[12px] text-zinc-500">
            {listKnowledgeArticles().length} artigos · {listDomainIds().length}{" "}
            domínios · {listKnowledgePacks().length} packs ·{" "}
            {listDigitalBusinesses().length} digitais ·{" "}
            {listLocalBusinesses().length} locais
          </p>
          <div className="flex flex-wrap gap-2">
            {listKnowledgePacks().map((p) => (
              <span
                key={p.id}
                className="rounded border border-emerald-500/20 px-2 py-1 text-[11px] text-emerald-100"
              >
                {p.name}
              </span>
            ))}
          </div>
          <div className="space-y-2">
            {listKnowledgeArticles()
              .slice(0, 12)
              .map((a) => (
                <article
                  key={a.id}
                  className="rounded border border-white/10 p-3 text-[12px]"
                >
                  <h3 className="font-medium text-zinc-100">{a.title}</h3>
                  <p className="text-zinc-500">{a.summary}</p>
                </article>
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-2">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="text-lg font-medium text-zinc-100">{value}</p>
    </div>
  );
}

function ProfilePanel({
  userId,
  profile,
  onSaved,
}: {
  userId: string;
  profile: ReturnType<typeof ensureBusinessProfile>;
  onSaved: () => void;
}) {
  const [experience, setExperience] = useState(profile.experience);
  const [capital, setCapital] = useState(profile.capital);
  const [skills, setSkills] = useState(profile.skills.join(", "));
  const [areas, setAreas] = useState<BusinessKnowledgeDomainId[]>(
    profile.interestAreas
  );
  const [mode, setMode] = useState<BusinessModeId | "">(profile.activeMode ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  const save = () => {
    const res = upsertBusinessProfile({
      userId,
      experience: experience as ExperienceLevel,
      capital: capital as CapitalBand,
      skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
      interestAreas: areas,
      activeMode: mode || null,
    });
    setMsg(res.ok ? "Salvo." : res.issues.join("; "));
    onSaved();
  };

  return (
    <section className="space-y-3" data-testid="be-panel-profile">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[12px] text-zinc-400">
          Experiência
          <select
            className="mt-1 w-full rounded border border-white/10 bg-zinc-950 px-2 py-2"
            value={experience}
            onChange={(e) => setExperience(e.target.value as ExperienceLevel)}
          >
            {["none", "beginner", "intermediate", "advanced", "expert"].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12px] text-zinc-400">
          Capital
          <select
            className="mt-1 w-full rounded border border-white/10 bg-zinc-950 px-2 py-2"
            value={capital}
            onChange={(e) => setCapital(e.target.value as CapitalBand)}
          >
            {["unknown", "bootstrap", "low", "medium", "high", "funded"].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-[12px] text-zinc-400">
        Habilidades
        <input
          className="mt-1 w-full rounded border border-white/10 bg-zinc-950 px-2 py-2"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
        />
      </label>
      <label className="block text-[12px] text-zinc-400">
        Modo ativo
        <select
          className="mt-1 w-full rounded border border-white/10 bg-zinc-950 px-2 py-2"
          value={mode}
          onChange={(e) => setMode(e.target.value as BusinessModeId | "")}
        >
          <option value="">—</option>
          {listBusinessModes().map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        {listKnowledgeDomains().slice(0, 12).map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() =>
              setAreas((prev) =>
                prev.includes(d.id)
                  ? prev.filter((x) => x !== d.id)
                  : [...prev, d.id]
              )
            }
            className={`rounded border px-2 py-1 text-[11px] ${
              areas.includes(d.id)
                ? "border-emerald-500/40 text-emerald-200"
                : "border-white/10 text-zinc-500"
            }`}
          >
            {d.name}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={save}
        className="rounded bg-emerald-600/80 px-3 py-2 text-[12px] text-white"
      >
        Salvar
      </button>
      {msg ? <p className="text-[12px] text-zinc-400">{msg}</p> : null}
    </section>
  );
}

function ObjectivesPanel({
  userId,
  objectives,
  onSaved,
}: {
  userId: string;
  objectives: ReturnType<typeof listObjectivesForUser>;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  return (
    <section className="space-y-3" data-testid="be-panel-objectives">
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border border-white/10 bg-zinc-950 px-2 py-2 text-[12px]"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Objetivo empresarial"
        />
        <button
          type="button"
          className="rounded bg-emerald-600/80 px-3 py-2 text-[12px] text-white"
          onClick={() => {
            if (!title.trim()) return;
            addBusinessObjective({
              userId,
              kind: "empreender",
              title: title.trim(),
              relatedDomains: ["validacao", "monetizacao"],
            });
            setTitle("");
            onSaved();
          }}
        >
          Add
        </button>
      </div>
      <ul className="space-y-2 text-[12px] text-zinc-300">
        {objectives.map((o) => (
          <li key={o.id} className="rounded border border-white/10 px-3 py-2">
            {o.title}
          </li>
        ))}
      </ul>
    </section>
  );
}

function BusinessesPanel({
  userId,
  ventures,
  onSaved,
}: {
  userId: string;
  ventures: ReturnType<typeof listVenturesForUser>;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<SupportedBusinessType>("infoproduto");
  return (
    <section className="space-y-3" data-testid="be-panel-businesses">
      <div className="flex flex-wrap gap-2">
        <input
          className="flex-1 rounded border border-white/10 bg-zinc-950 px-2 py-2 text-[12px]"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome"
        />
        <select
          className="rounded border border-white/10 bg-zinc-950 px-2 py-2 text-[12px]"
          value={type}
          onChange={(e) => setType(e.target.value as SupportedBusinessType)}
        >
          {listSupportedBusinessTypes().map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded bg-emerald-600/80 px-3 py-2 text-[12px] text-white"
          onClick={() => {
            if (!name.trim()) return;
            addBusinessVenture({ userId, name: name.trim(), type });
            setName("");
            onSaved();
          }}
        >
          Registrar
        </button>
      </div>
      <ul className="space-y-2 text-[12px]">
        {ventures.map((v) => (
          <li key={v.id} className="rounded border border-emerald-500/20 px-3 py-2">
            {v.name} · {v.type}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ToolsPanel({
  userId,
  onSaved,
}: {
  userId: string;
  onSaved: () => void;
}) {
  const [idea, setIdea] = useState("Curso de marketing local para clínicas");
  const [ideaOut, setIdeaOut] = useState<string | null>(null);
  const [affOut, setAffOut] = useState<string | null>(null);
  const [prodOut, setProdOut] = useState<string | null>(null);
  const [localOut, setLocalOut] = useState<string | null>(null);

  return (
    <section className="space-y-4" data-testid="be-panel-tools">
      <div className="rounded border border-white/10 p-3">
        <h3 className="text-sm text-zinc-100">Idea Validator</h3>
        <textarea
          className="mt-2 w-full rounded border border-white/10 bg-zinc-950 p-2 text-[12px]"
          rows={2}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />
        <button
          type="button"
          className="mt-2 rounded bg-emerald-600/80 px-3 py-1.5 text-[12px] text-white"
          onClick={() => {
            const r = validateBusinessIdea({
              idea,
              audience: "donos de clínicas",
              capital: "low",
              time: "part-time",
              experience: "beginner",
            });
            setIdeaOut(
              `Score ${r.score} · ${r.difficulty} · ${r.recommendation}`
            );
            onSaved();
          }}
        >
          Validar ideia
        </button>
        {ideaOut ? <p className="mt-2 text-[12px] text-zinc-400">{ideaOut}</p> : null}
      </div>

      <div className="rounded border border-white/10 p-3">
        <h3 className="text-sm text-zinc-100">Affiliate Assistant</h3>
        <button
          type="button"
          className="mt-2 rounded bg-emerald-600/80 px-3 py-1.5 text-[12px] text-white"
          onClick={() => {
            const r = runAffiliateAssistant({
              timeAvailable: "part-time",
              capital: "bootstrap",
              paidTraffic: false,
              organic: true,
              experience: "beginner",
              financialGoal: "Primeira comissão em 60 dias",
            });
            setAffOut(
              r.complete
                ? r.summary
                : r.missingQuestions.join(" | ")
            );
            onSaved();
          }}
        >
          Gerar plano afiliado
        </button>
        {affOut ? <p className="mt-2 text-[12px] text-zinc-400">{affOut}</p> : null}
      </div>

      <div className="rounded border border-white/10 p-3">
        <h3 className="text-sm text-zinc-100">Product Builder</h3>
        <button
          type="button"
          className="mt-2 rounded bg-emerald-600/80 px-3 py-1.5 text-[12px] text-white"
          onClick={() => {
            const r = runProductBuilder({
              problem: "Leads frios",
              audience: "Infoprodutores iniciantes",
              format: "Curso",
              ticket: "R$ 297",
              deadline: "30 dias",
            });
            setProdOut(
              r.complete
                ? `${r.name} — ${r.promise}`
                : r.missingQuestions.join(" | ")
            );
            onSaved();
          }}
        >
          Montar produto
        </button>
        {prodOut ? <p className="mt-2 text-[12px] text-zinc-400">{prodOut}</p> : null}
      </div>

      <div className="rounded border border-white/10 p-3">
        <h3 className="text-sm text-zinc-100">Local Business Advisor</h3>
        <button
          type="button"
          className="mt-2 rounded bg-emerald-600/80 px-3 py-1.5 text-[12px] text-white"
          onClick={() => {
            const r = runLocalBusinessAdvisor({
              city: "São Paulo",
              capital: "medium",
              type: "hamburgueria" as LocalBusinessId,
              goal: "Lucro operacional em 12 meses",
              time: "full-time",
            });
            setLocalOut(r.complete ? r.summary : r.missingQuestions.join(" | "));
            onSaved();
          }}
        >
          Gerar plano local
        </button>
        {localOut ? (
          <p className="mt-2 text-[12px] text-zinc-400">{localOut}</p>
        ) : null}
      </div>
      <p className="text-[11px] text-zinc-500">user: {userId}</p>
    </section>
  );
}
