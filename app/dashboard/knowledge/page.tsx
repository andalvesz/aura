import { KnowledgeHubClient } from "@/components/dashboard/knowledge/knowledge-hub-client";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import {
  listKnowledgeCollections,
  listKnowledgeDocuments,
} from "@/lib/supabase/services/knowledge-hub.service";
import Link from "next/link";

export default async function KnowledgeHubPage() {
  let items: Awaited<ReturnType<typeof listKnowledgeDocuments>>["items"] = [];
  let total = 0;
  let collections: Awaited<ReturnType<typeof listKnowledgeCollections>> = [];

  try {
    const listed = await listKnowledgeDocuments({ limit: 40 });
    items = listed.items;
    total = listed.total;
  } catch {
    /* unauthenticated / empty */
  }
  try {
    collections = await listKnowledgeCollections();
  } catch {
    /* ignore */
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4" data-testid="knowledge-page">
      <PageBreadcrumb
        items={[
          { label: "Aura", href: "/dashboard" },
          { label: "Knowledge Hub" },
        ]}
      />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-medium text-zinc-100">Knowledge Hub</h1>
          <p className="text-[12px] text-zinc-500">
            Documentos · Notas · Links · Arquivos · Anexos · Pesquisa
          </p>
        </div>
        <Link
          href="/dashboard/knowledge/connect"
          className="text-[11px] text-zinc-500 hover:text-cyan-300"
        >
          Aura Knowledge & Connect →
        </Link>
      </div>
      <KnowledgeHubClient
        initialDocuments={items}
        initialTotal={total}
        collections={collections}
      />
    </div>
  );
}
