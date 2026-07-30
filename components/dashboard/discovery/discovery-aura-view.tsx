import Link from "next/link";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { AuraBrainOnboarding } from "@/components/dashboard/aura-brain-onboarding";
import { DiscoveryArtifactActions } from "@/components/dashboard/discovery/discovery-artifact-actions";
import { DiscoveryBootstrapButton } from "@/components/dashboard/discovery/discovery-bootstrap-button";
import { DiscoveryFiltersBar } from "@/components/dashboard/discovery/discovery-filters";
import { DiscoveryDetailPanel } from "@/components/dashboard/discovery/discovery-detail";
import { DiscoverySearch } from "@/components/dashboard/discovery/discovery-search";
import { DiscoveryTimeline } from "@/components/dashboard/discovery/discovery-timeline";
import type {
  DiscoveryArtifact,
  DiscoveryArtifactType,
} from "@/lib/discovery/types";
import {
  bootstrapDiscoveryEngine,
  explainDiscoveryService,
  getAuraBrainTimeline,
  listDiscoveries,
  searchAuraBrain,
} from "@/lib/supabase/services/discovery-engine.service";

const SECTIONS: Array<{
  key: string;
  title: string;
  types?: DiscoveryArtifactType[];
  statuses?: DiscoveryArtifact["status"][];
  archived?: boolean;
}> = [
  { key: "opportunity", title: "Oportunidades", types: ["OPPORTUNITY"] },
  { key: "risk", title: "Riscos", types: ["RISK"] },
  { key: "gap", title: "Lacunas", types: ["GAP"] },
  { key: "dependency", title: "Dependências", types: ["DEPENDENCY"] },
  { key: "stagnation", title: "Estagnação", types: ["STAGNATION"] },
  { key: "duplicate", title: "Duplicações", types: ["DUPLICATE"] },
  {
    key: "unknown",
    title: "Necessita confirmação",
    types: ["UNKNOWN"],
    statuses: ["PENDING_CONFIRMATION", "GENERATED"],
  },
  {
    key: "archived",
    title: "Arquivadas",
    statuses: ["ARCHIVED", "SUPPRESSED", "OUTDATED", "REJECTED"],
    archived: true,
  },
];

function DiscoveryCard({
  artifact,
  selected,
}: {
  artifact: DiscoveryArtifact;
  selected?: boolean;
}) {
  const date = new Date(artifact.createdAt).toLocaleDateString("pt-BR");
  return (
    <li
      className={`rounded-md border p-3 ${
        selected
          ? "border-cyan-500/40 bg-cyan-950/20"
          : "border-white/[0.06] bg-zinc-950/50"
      }`}
      data-testid="discovery-artifact-row"
      data-discovery-type={artifact.type}
      data-discovery-status={artifact.status}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] text-zinc-100">{artifact.title}</p>
          <p className="mt-1 text-[12px] text-zinc-400">{artifact.summary}</p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {artifact.type} · impacto {artifact.impact} · urgência{" "}
            {artifact.urgency}
          </p>
          {artifact.relatedEntities.length ? (
            <p className="mt-1 text-[10px] text-zinc-600">
              Entidades:{" "}
              {artifact.relatedEntities
                .slice(0, 3)
                .map((e) => (
                  <Link
                    key={e.entityId}
                    href={`/dashboard/settings/world-model#${e.entityId}`}
                    className="mr-1 text-cyan-500/80 hover:underline"
                  >
                    {e.entityId.slice(0, 8)}
                  </Link>
                ))}
            </p>
          ) : null}
        </div>
        <div className="text-right text-[10px] text-zinc-500">
          <p>
            {artifact.status} · {artifact.confidence}%
          </p>
          <p>{date}</p>
          <p>origem: {artifact.origin}</p>
          <p data-testid="execution-influence-none">
            execução: {artifact.executionInfluence}
          </p>
        </div>
      </div>
      <DiscoveryArtifactActions
        artifactId={artifact.id}
        rowVersion={artifact.rowVersion}
        showOpen
      />
    </li>
  );
}

export async function DiscoveryAuraView({
  selectedId,
  typeFilter,
  statusFilter,
  minConfidence,
  periodFrom,
  periodTo,
  searchQuery,
}: {
  selectedId?: string | null;
  typeFilter?: string | null;
  statusFilter?: string | null;
  minConfidence?: number | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  searchQuery?: string | null;
}) {
  let all = await listDiscoveries({
    includeArchived: true,
    limit: 120,
    types: typeFilter
      ? [typeFilter as DiscoveryArtifactType]
      : undefined,
    statuses: statusFilter
      ? [statusFilter as DiscoveryArtifact["status"]]
      : undefined,
    minConfidence: minConfidence ?? undefined,
    periodFrom: periodFrom ?? undefined,
    periodTo: periodTo ?? undefined,
  });

  if (all.length === 0) {
    await bootstrapDiscoveryEngine({ maxItems: 24 });
    all = await listDiscoveries({ includeArchived: true, limit: 120 });
  }

  const selected =
    (selectedId ? all.find((a) => a.id === selectedId) : null) ?? null;
  const explanation = selected
    ? await explainDiscoveryService(selected.id)
    : null;
  const timeline = await getAuraBrainTimeline(30);
  const searchResults = searchQuery
    ? await searchAuraBrain(searchQuery, 20)
    : [];

  return (
    <div className="space-y-4" data-testid="discovery-aura-view">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium text-zinc-100">Discovery</h1>
          <p className="text-[12px] text-zinc-500">
            Sinais read-only do Aura Brain — confirmar, rejeitar ou arquivar.
            Sem execução automática.
          </p>
        </div>
        <DiscoveryBootstrapButton />
      </div>

      <AuraBrainOnboarding />

      <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
        <Link href="/dashboard" className="hover:text-zinc-300">
          Dashboard
        </Link>
        <Link
          href="/dashboard/settings/memory"
          className="hover:text-zinc-300"
        >
          Memórias
        </Link>
        <Link
          href="/dashboard/settings/world-model"
          className="hover:text-zinc-300"
        >
          Mapa
        </Link>
        <Link
          href="/dashboard/settings/insights"
          className="hover:text-zinc-300"
        >
          Insights
        </Link>
        <Link
          href="/dashboard/settings/aura-brain"
          className="hover:text-zinc-300"
        >
          Aura Brain
        </Link>
      </div>

      <DiscoverySearch initialQuery={searchQuery ?? ""} />
      {searchResults.length ? (
        <DashboardCard title="Resultados da busca" status="ok" testId="discovery-search-results">
          <ul className="space-y-1.5 text-[12px]">
            {searchResults.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <Link
                  href={r.href}
                  className="text-cyan-300/90 hover:underline"
                >
                  [{r.kind}] {r.title}
                </Link>
                <span className="ml-2 text-[10px] text-zinc-600">
                  {r.summary.slice(0, 80)}
                </span>
              </li>
            ))}
          </ul>
        </DashboardCard>
      ) : null}

      <DiscoveryFiltersBar />

      {selected ? (
        <DiscoveryDetailPanel artifact={selected} explanation={explanation} />
      ) : null}

      {SECTIONS.map((section) => {
        const items = all.filter((a) => {
          if (section.types && !section.types.includes(a.type)) return false;
          if (section.statuses && !section.statuses.includes(a.status)) {
            if (section.archived) return section.statuses.includes(a.status);
            return false;
          }
          if (section.key === "unknown") {
            return (
              a.type === "UNKNOWN" ||
              a.status === "PENDING_CONFIRMATION"
            );
          }
          if (section.archived) {
            return ["ARCHIVED", "SUPPRESSED", "OUTDATED", "REJECTED"].includes(
              a.status
            );
          }
          if (
            ["ARCHIVED", "SUPPRESSED", "OUTDATED", "REJECTED"].includes(a.status)
          ) {
            return false;
          }
          return true;
        });

        // Deduplicate UNKNOWN section vs pending of other types
        const unique =
          section.key === "unknown"
            ? items.filter(
                (a, i, arr) => arr.findIndex((x) => x.id === a.id) === i
              )
            : items;

        return (
          <DashboardCard
            key={section.key}
            title={section.title}
            status={unique.length ? "ok" : "empty"}
            emptyTitle="Nenhuma descoberta nesta seção"
            emptyDescription="Registre uma memória para o Aura começar a identificar conexões."
            testId={`discovery-section-${section.key}`}
          >
            <ul className="space-y-2">
              {unique.slice(0, 12).map((a) => (
                <DiscoveryCard
                  key={a.id}
                  artifact={a}
                  selected={a.id === selectedId}
                />
              ))}
            </ul>
          </DashboardCard>
        );
      })}

      <DiscoveryTimeline entries={timeline} />
    </div>
  );
}
