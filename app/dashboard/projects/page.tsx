import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import {
  CreateProjectForm,
  ProjectsKanban,
  ProjectsList,
} from "@/components/dashboard/projects/projects-board";
import {
  getProjectsBoard,
  listProjects,
} from "@/lib/supabase/services/projects.service";

export default async function ProjectsPage() {
  const [board, recent] = await Promise.all([
    getProjectsBoard(),
    listProjects({ limit: 12 }),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4" data-testid="projects-page">
      <PageBreadcrumb
        items={[
          { label: "Meu Dia", href: "/dashboard" },
          { label: "Projetos" },
        ]}
      />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-medium text-zinc-100">Projetos</h1>
          <p className="text-[12px] text-zinc-500">
            Ideia → projeto · memórias · discovery · documentos · colaboração ·
            sem execução
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <CreateProjectForm />
        <div className="space-y-2">
          <h2 className="text-[12px] font-medium uppercase tracking-wide text-zinc-500">
            Recentes
          </h2>
          <ProjectsList projects={recent.slice(0, 6)} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-zinc-500">
          Kanban por status
        </h2>
        <ProjectsKanban board={board} />
      </div>
    </div>
  );
}
