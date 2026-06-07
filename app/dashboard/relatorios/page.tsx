import { FileText } from "lucide-react";
import Link from "next/link";
import { RelatoriosView } from "@/components/dashboard/modules/relatorios-view";

export default function RelatoriosPage() {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-cyan-400" />
          <h1 className="text-xl font-semibold text-zinc-100 sm:text-2xl">Relatórios</h1>
        </div>
        <p className="mt-0.5 text-sm text-zinc-500">
          Relatório semanal automático com análise inteligente da Aura
        </p>
        <Link
          href="/dashboard"
          className="mt-2 inline-block text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ← Voltar à visão geral
        </Link>
      </div>
      <RelatoriosView />
    </div>
  );
}
