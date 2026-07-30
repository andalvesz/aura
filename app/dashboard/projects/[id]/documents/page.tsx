import { notFound } from "next/navigation";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import { ProjectDocumentsClient } from "@/components/dashboard/projects/project-documents-client";
import {
  getProject,
  listProjectDocuments,
} from "@/lib/supabase/services/projects.service";

export default async function ProjectDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const documents = await listProjectDocuments(id);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <PageBreadcrumb
        items={[
          { label: "Projetos", href: "/dashboard/projects" },
          { label: project.name, href: `/dashboard/projects/${id}` },
          { label: "Documentos" },
        ]}
      />
      <div>
        <h1 className="text-lg font-medium text-zinc-100">Documentos</h1>
        <p className="text-[12px] text-zinc-500">
          PDF, imagem, áudio, links e arquivos — pesquisáveis.
        </p>
      </div>
      <ProjectDocumentsClient projectId={id} initial={documents} />
    </div>
  );
}
