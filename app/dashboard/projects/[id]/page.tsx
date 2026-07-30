import { notFound } from "next/navigation";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import { ProjectDetailClient } from "@/components/dashboard/projects/project-detail-client";
import {
  getProject,
  listProjectDiscoveries,
  listProjectDocuments,
  listProjectMemories,
  listProjectTimeline,
} from "@/lib/supabase/services/projects.service";
import { listProjectKnowledgeDocuments } from "@/lib/supabase/services/knowledge-hub.service";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [timeline, documents, discoveries, memories, knowledgeDocuments] =
    await Promise.all([
      listProjectTimeline(id, 60),
      listProjectDocuments(id),
      listProjectDiscoveries(id),
      listProjectMemories(id),
      listProjectKnowledgeDocuments(id).catch(() => []),
    ]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <PageBreadcrumb
        items={[
          { label: "Meu Dia", href: "/dashboard" },
          { label: "Projetos", href: "/dashboard/projects" },
          { label: project.name },
        ]}
      />
      <ProjectDetailClient
        project={project}
        timeline={timeline}
        documents={documents}
        discoveries={discoveries}
        memories={memories.map((m) => ({ id: m.id, title: m.title }))}
        knowledgeDocuments={knowledgeDocuments}
      />
    </div>
  );
}
