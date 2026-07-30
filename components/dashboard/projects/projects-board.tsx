"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createProjectAction,
  setProjectStatusAction,
  toggleProjectFavoriteAction,
} from "@/app/actions/projects";
import type { Project, ProjectStatus } from "@/lib/projects/types";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
} from "@/lib/projects/types";
import { FORM_INPUT_CLASS } from "@/utils/dashboard-mobile";

export function CreateProjectForm({
  businessId,
}: {
  businessId?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <form
      className="space-y-2 rounded-lg border border-white/10 bg-zinc-950/50 p-3"
      data-testid="create-project-form"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await createProjectAction({
            name,
            description,
            status: "idea",
            businessId: businessId ?? null,
          });
          if (res.error || !res.project) {
            toast.error(res.error ?? "Falha ao criar");
            return;
          }
          toast.success("Projeto criado");
          setName("");
          setDescription("");
          router.push(`/dashboard/projects/${res.project.id}`);
          router.refresh();
        });
      }}
    >
      <p className="text-[12px] font-medium text-zinc-200">Novo projeto</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="Nome"
        className={FORM_INPUT_CLASS}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Descrição (opcional)"
        className={`${FORM_INPUT_CLASS} py-2`}
      />
      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="min-h-11 rounded bg-cyan-500/90 px-3 text-[13px] font-medium text-zinc-950 disabled:opacity-40"
      >
        {pending ? "Criando…" : "Criar projeto"}
      </button>
    </form>
  );
}

export function ProjectCard({ project }: { project: Project }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div
      className="rounded-lg border border-white/[0.06] bg-zinc-950/60 p-3"
      data-testid="project-card"
      style={{ borderLeftColor: project.color, borderLeftWidth: 3 }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/project-id", project.id);
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/dashboard/projects/${project.id}`}
          className="min-w-0 text-[13px] font-medium text-zinc-100 hover:text-cyan-300"
        >
          {project.name}
        </Link>
        <button
          type="button"
          disabled={pending}
          className="text-[12px] text-amber-300/80"
          aria-label="Favoritar"
          onClick={() =>
            start(async () => {
              await toggleProjectFavoriteAction(project.id);
              router.refresh();
            })
          }
        >
          {project.favorite ? "★" : "☆"}
        </button>
      </div>
      {project.description ? (
        <p className="mt-1 line-clamp-2 text-[11px] text-zinc-500">
          {project.description}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-500">
          {PROJECT_STATUS_LABELS[project.status]}
        </span>
        {project.tags.slice(0, 3).map((t) => (
          <span
            key={t}
            className="rounded border border-white/5 px-1.5 py-0.5 text-[10px] text-zinc-600"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ProjectsKanban({
  board,
}: {
  board: Record<ProjectStatus, Project[]>;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const columns = PROJECT_STATUSES.filter((s) => s !== "archived");

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      data-testid="projects-kanban"
    >
      {columns.map((status) => (
        <div
          key={status}
          className="min-h-[12rem] rounded-lg border border-white/[0.06] bg-zinc-950/40 p-2"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData("text/project-id");
            if (!id) return;
            start(async () => {
              const res = await setProjectStatusAction(id, status);
              if (res.error) toast.error(res.error);
              else toast.success(`Movido para ${PROJECT_STATUS_LABELS[status]}`);
              router.refresh();
            });
          }}
        >
          <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            {PROJECT_STATUS_LABELS[status]}
            <span className="ml-1 text-zinc-700">
              ({board[status]?.length ?? 0})
            </span>
          </p>
          <div className={`space-y-2 ${pending ? "opacity-70" : ""}`}>
            {(board[status] ?? []).map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProjectsList({ projects }: { projects: Project[] }) {
  if (!projects.length) {
    return (
      <p className="rounded-lg border border-dashed border-white/10 p-6 text-center text-[13px] text-zinc-500">
        Nenhum projeto ainda. Transforme uma ideia em projeto acima.
      </p>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {projects.map((p) => (
        <li key={p.id}>
          <ProjectCard project={p} />
        </li>
      ))}
    </ul>
  );
}
