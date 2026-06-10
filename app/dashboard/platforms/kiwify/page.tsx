import Link from "next/link";
import { Suspense } from "react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { KiwifyConnectView } from "@/components/dashboard/modules/kiwify-connect-view";
import { ListSkeleton } from "@/components/dashboard/loading-skeleton";
import { getModule } from "@/lib/modules";

export default function PlatformsKiwifyPage() {
  const mod = getModule("platforms");
  return (
    <div className="space-y-3">
      <ModuleHeader
        module={{
          ...mod,
          label: "Kiwify Connect",
          description:
            "Conecte a API Kiwify, importe vendas e comissões e alimente Performance, Money e CEO.",
        }}
      />
      <nav className="flex gap-2 text-[11px]">
        <Link href="/dashboard/platforms" className="text-zinc-500 hover:text-zinc-300">
          Platform Hub
        </Link>
        <span className="text-zinc-600">/</span>
        <span className="text-violet-300">Kiwify</span>
      </nav>
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <KiwifyConnectView />
      </Suspense>
    </div>
  );
}
