import Link from "next/link";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { WorldBootstrapButton } from "@/components/dashboard/world-model/world-bootstrap-button";
import { WorldRelationshipActions } from "@/components/dashboard/world-model/world-relationship-actions";
import type { WorldEntity, WorldRelationship } from "@/lib/world-model/types";
import {
  bootstrapWorldModel,
  explainEntity,
  getEntityNeighbors,
  getRelationshipTimeline,
  listWorldEntities,
  listWorldRelationships,
} from "@/lib/supabase/services/world-model.service";
import { getDataContext } from "@/lib/supabase/services/context";

function EntityRow({
  entity,
  explanation,
}: {
  entity: WorldEntity;
  explanation?: string | null;
}) {
  return (
    <li
      className="rounded-md border border-white/[0.06] bg-zinc-950/50 p-3"
      data-testid="world-entity-row"
      data-entity-type={entity.entityType}
      data-entity-status={entity.status}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] text-zinc-100">{entity.displayName}</p>
          <p className="text-[11px] text-zinc-500">
            {entity.entityType} · {entity.context}
          </p>
          {entity.description ? (
            <p className="mt-1 text-[11px] text-zinc-600">{entity.description}</p>
          ) : null}
        </div>
        <div className="text-right text-[10px] text-zinc-500">
          <p>
            {entity.status} · {entity.confidence}%
          </p>
          <p>origem: {entity.sourceType}</p>
          {entity.sourceReference ? (
            <p>
              fonte: {entity.sourceReference.entityType}:
              {entity.sourceReference.entityId.slice(0, 8)}
            </p>
          ) : null}
        </div>
      </div>
      {explanation ? (
        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-2 text-[10px] text-zinc-500">
          {explanation}
        </pre>
      ) : null}
    </li>
  );
}

function RelRow({
  relationship,
  sourceName,
  targetName,
}: {
  relationship: WorldRelationship;
  sourceName: string;
  targetName: string;
}) {
  return (
    <li
      className="rounded-md border border-white/[0.06] bg-zinc-950/50 p-3"
      data-testid="world-rel-row"
      data-rel-status={relationship.status}
    >
      <p className="text-[13px] text-zinc-100">
        {sourceName}{" "}
        <span className="text-zinc-500">—[{relationship.relationshipType}]→</span>{" "}
        {targetName}
      </p>
      <p className="text-[11px] text-zinc-600">
        {relationship.status} · conf {relationship.confidence}% · projeção{" "}
        {relationship.projectionConfidence}% · {relationship.sourceType}
      </p>
      <WorldRelationshipActions relationship={relationship} />
    </li>
  );
}

export async function WorldMapView() {
  await bootstrapWorldModel({ maxItems: 40 });
  await getDataContext();

  const entities = await listWorldEntities({
    includeArchived: true,
    limit: 100,
  });
  const relationships = await listWorldRelationships({
    includeArchived: true,
    limit: 200,
  });
  const timeline = await getRelationshipTimeline();

  const people = entities.filter((e) => e.entityType === "person");
  const missions = entities.filter((e) => e.entityType === "mission");
  const projects = entities.filter(
    (e) => e.entityType === "project" || e.entityType === "goal"
  );
  const businesses = entities.filter(
    (e) =>
      e.entityType === "business" ||
      e.entityType === "organization" ||
      e.entityType === "workspace"
  );
  const skills = entities.filter(
    (e) =>
      e.entityType === "skill" ||
      e.entityType === "language" ||
      e.entityType === "concept"
  );
  const documents = entities.filter((e) => e.entityType === "document");
  const resources = entities.filter(
    (e) => e.entityType === "resource" || e.entityType === "procedure"
  );

  const pending = relationships.filter(
    (r) =>
      r.status === "PENDING_CONFIRMATION" ||
      r.status === "HYPOTHESIS" ||
      r.status === "ACTIVE"
  );
  const rejected = relationships.filter(
    (r) => r.status === "REJECTED" || r.status === "ARCHIVED"
  );

  const focus = entities[0];
  let neighbors: Awaited<ReturnType<typeof getEntityNeighbors>>["neighbors"] =
    [];
  let focusExplain: string | null = null;
  if (focus) {
    neighbors = (await getEntityNeighbors(focus.id, { limit: 12 })).neighbors;
    focusExplain = (await explainEntity(focus.id)).explanation;
  }

  const nameOf = (id: string) =>
    entities.find((e) => e.id === id)?.displayName ?? id.slice(0, 8);

  return (
    <div className="space-y-6" data-testid="world-map-view">
      <header className="space-y-1">
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">
          Aura Brain
        </p>
        <h1 className="text-lg font-semibold text-zinc-100">Mapa do Aura</h1>
        <p className="text-[13px] text-zinc-500">
          Conexões entre missões, identidade e memórias — sem executar ações.
          O mapa é uma projeção cognitiva; a fonte operacional permanece a
          autoridade.
        </p>
        <div className="flex flex-wrap gap-3 pt-1 text-[12px]">
          <Link
            href="/dashboard/settings/aura-brain"
            className="text-zinc-500 hover:text-zinc-300"
          >
            ← Aura Brain
          </Link>
          <Link
            href="/dashboard/settings/memory"
            className="text-sky-400/90 hover:text-sky-300"
          >
            Memórias →
          </Link>
          <Link
            href="/dashboard/settings/identity"
            className="text-amber-400/90 hover:text-amber-300"
          >
            Identidade →
          </Link>
          <Link
            href="/dashboard/settings/insights"
            className="text-cyan-400/90 hover:text-cyan-300"
          >
            Insights →
          </Link>
        </div>
      </header>

      <DashboardCard title="Visão geral" status="ok">
        <dl className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
          <div>
            <dt className="text-zinc-500">Entidades</dt>
            <dd className="text-zinc-200">{entities.length}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Relações</dt>
            <dd className="text-zinc-200">{relationships.length}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Missões</dt>
            <dd className="text-zinc-200">{missions.length}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Execução</dt>
            <dd className="text-zinc-200">none</dd>
          </div>
        </dl>
        <div className="mt-3">
          <WorldBootstrapButton />
        </div>
      </DashboardCard>

      <DashboardCard title="Pessoas" status="ok">
        {people.length ? (
          <ul className="space-y-2">
            {people.map((e) => (
              <EntityRow key={e.id} entity={e} />
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-zinc-600">
            Nenhuma pessoa no mapa. Registre memórias compartilhadas para o Aura
            projetar entidades.
          </p>
        )}
      </DashboardCard>

      <DashboardCard title="Missões" status="ok">
        {missions.length ? (
          <ul className="space-y-2">
            {missions.map((e) => (
              <EntityRow key={e.id} entity={e} />
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-zinc-600">Nenhuma missão projetada.</p>
        )}
      </DashboardCard>

      <DashboardCard title="Projetos e objetivos" status="ok">
        {projects.length ? (
          <ul className="space-y-2">
            {projects.map((e) => (
              <EntityRow key={e.id} entity={e} />
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-zinc-600">Nenhum projeto/objetivo.</p>
        )}
      </DashboardCard>

      <DashboardCard title="Negócios" status="ok">
        {businesses.length ? (
          <ul className="space-y-2">
            {businesses.map((e) => (
              <EntityRow key={e.id} entity={e} />
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-zinc-600">Nenhum negócio projetado.</p>
        )}
      </DashboardCard>

      <DashboardCard title="Habilidades e preferências" status="ok">
        {skills.length ? (
          <ul className="space-y-2">
            {skills.map((e) => (
              <EntityRow key={e.id} entity={e} />
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-zinc-600">Nenhuma skill/conceito.</p>
        )}
      </DashboardCard>

      <DashboardCard title="Documentos" status="ok">
        {documents.length ? (
          <ul className="space-y-2">
            {documents.map((e) => (
              <EntityRow key={e.id} entity={e} />
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-zinc-600">Nenhum documento.</p>
        )}
      </DashboardCard>

      <DashboardCard title="Recursos" status="ok">
        {resources.length ? (
          <ul className="space-y-2">
            {resources.map((e) => (
              <EntityRow key={e.id} entity={e} />
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-zinc-600">Nenhum recurso.</p>
        )}
      </DashboardCard>

      {focus ? (
        <DashboardCard title={`Conexões de ${focus.displayName}`} status="ok">
          {focusExplain ? (
            <pre className="mb-3 max-h-28 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-2 text-[10px] text-zinc-500">
              {focusExplain}
            </pre>
          ) : null}
          {neighbors.length ? (
            <ul className="space-y-2">
              {neighbors.map((n) => (
                <RelRow
                  key={n.relationship.id}
                  relationship={n.relationship}
                  sourceName={
                    n.direction === "outgoing"
                      ? focus.displayName
                      : n.entity.displayName
                  }
                  targetName={
                    n.direction === "outgoing"
                      ? n.entity.displayName
                      : focus.displayName
                  }
                />
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-zinc-600">Sem vizinhos.</p>
          )}
        </DashboardCard>
      ) : null}

      <DashboardCard title="Conexões recentes / em revisão" status="ok">
        {pending.length ? (
          <ul className="space-y-2">
            {pending.slice(0, 20).map((r) => (
              <RelRow
                key={r.id}
                relationship={r}
                sourceName={nameOf(r.sourceEntityId)}
                targetName={nameOf(r.targetEntityId)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-zinc-600">Nenhuma conexão pendente.</p>
        )}
      </DashboardCard>

      <DashboardCard title="Rejeitadas ou arquivadas" status="ok">
        {rejected.length ? (
          <ul className="space-y-2">
            {rejected.slice(0, 15).map((r) => (
              <RelRow
                key={r.id}
                relationship={r}
                sourceName={nameOf(r.sourceEntityId)}
                targetName={nameOf(r.targetEntityId)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-zinc-600">Nenhuma rejeitada.</p>
        )}
      </DashboardCard>

      <DashboardCard title="Linha do tempo de relações" status="ok">
        {timeline.length ? (
          <ol className="space-y-2" data-testid="world-timeline">
            {timeline.slice(0, 20).map((t) => (
              <li
                key={t.relationship.id}
                className="border-l border-white/10 pl-3 text-[12px]"
              >
                <p className="text-zinc-300">
                  {t.relationship.relationshipType} · {t.relationship.status}
                </p>
                <p className="text-[11px] text-zinc-600">
                  {t.relationship.firstObservedAt.slice(0, 10)}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[12px] text-zinc-600">Timeline vazia.</p>
        )}
      </DashboardCard>
    </div>
  );
}
