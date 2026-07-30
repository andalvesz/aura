import { listMemoryAttachments } from "@/lib/supabase/services/smart-capture.service";
import { AttachmentsLibraryClient } from "@/components/dashboard/smart-capture/attachments-library-client";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";

export default async function AttachmentsPage() {
  const attachments = await listMemoryAttachments();

  return (
    <div
      className="mx-auto w-full max-w-2xl space-y-4"
      data-testid="attachments-page"
    >
      <PageBreadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Anexos" },
        ]}
      />
      <div>
        <h1 className="text-lg font-medium text-zinc-100">Biblioteca de anexos</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Imagens, PDFs, links, áudios e arquivos — pesquisáveis (OCR, tags, nome).
        </p>
      </div>
      <AttachmentsLibraryClient initial={attachments} />
    </div>
  );
}
