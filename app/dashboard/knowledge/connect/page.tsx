import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { KnowledgeConnectView } from "@/components/dashboard/modules/knowledge-connect-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";
import { getModule } from "@/lib/modules";
import Link from "next/link";

/** Legacy Aura Knowledge & Connect — preserved under /knowledge/connect */
export default function KnowledgeConnectPage() {
  const mod = getModule("knowledge");
  return (
    <div className="space-y-3">
      <PageBreadcrumb
        items={[
          { label: "Aura", href: "/dashboard" },
          { label: "Knowledge Hub", href: "/dashboard/knowledge" },
          { label: "Connect" },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ModuleHeader module={mod} />
        <Link
          href="/dashboard/knowledge"
          className="text-[11px] text-cyan-300"
        >
          ← Knowledge Hub
        </Link>
      </div>
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <KnowledgeConnectView />
      </Suspense>
    </div>
  );
}
