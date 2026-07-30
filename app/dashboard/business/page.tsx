import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import { BusinessHubClient } from "@/components/dashboard/projects/business-hub-client";
import {
  listBusinesses,
  listProjects,
} from "@/lib/supabase/services/projects.service";

export default async function BusinessHubPage() {
  const [businesses, projects] = await Promise.all([
    listBusinesses(),
    listProjects({ includeArchived: true, limit: 200 }),
  ]);

  const projectsByBusiness: Record<
    string,
    Array<{ id: string; name: string }>
  > = {};
  for (const p of projects) {
    if (!p.businessId) continue;
    const list = projectsByBusiness[p.businessId] ?? [];
    list.push({ id: p.id, name: p.name });
    projectsByBusiness[p.businessId] = list;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4" data-testid="business-page">
      <PageBreadcrumb
        items={[
          { label: "Meu Dia", href: "/dashboard" },
          { label: "Business Hub" },
        ]}
      />
      <div>
        <h1 className="text-lg font-medium text-zinc-100">Business Hub</h1>
        <p className="text-[12px] text-zinc-500">
          Empresa → Projetos → Memórias → Discovery → Documentos
        </p>
      </div>
      <BusinessHubClient
        businesses={businesses}
        projectsByBusiness={projectsByBusiness}
      />
    </div>
  );
}
