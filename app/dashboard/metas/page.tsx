import { Target } from "lucide-react";
import Link from "next/link";
import { MetasView } from "@/components/dashboard/modules/metas-view";

export default function MetasPage() {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <Target className="size-5 text-amber-400" />
          <h1 className="text-xl font-semibold text-zinc-100 sm:text-2xl">Metas</h1>
        </div>
        <p className="mt-0.5 text-sm text-zinc-500">
          Central de metas pessoais, financeiras e profissionais
        </p>
        <Link
          href="/dashboard"
          className="mt-2 inline-block text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ← Voltar à visão geral
        </Link>
      </div>
      <MetasView />
    </div>
  );
}
