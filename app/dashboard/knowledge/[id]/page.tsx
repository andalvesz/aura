import { notFound } from "next/navigation";
import { KnowledgeDocumentView } from "@/components/dashboard/knowledge/knowledge-document-view";
import { getKnowledgeDocument } from "@/lib/supabase/services/knowledge-hub.service";

export default async function KnowledgeDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let doc = null;
  try {
    doc = await getKnowledgeDocument(id);
  } catch {
    doc = null;
  }
  if (!doc) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl py-2">
      <KnowledgeDocumentView document={doc} />
    </div>
  );
}
