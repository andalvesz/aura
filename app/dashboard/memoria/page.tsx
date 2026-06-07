import Link from "next/link";
import { Brain } from "lucide-react";
import { MemoriaView } from "@/components/dashboard/modules/memoria-view";

export default function MemoriaPage() {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <Brain className="size-5 text-violet-400" />
          <h1 className="text-xl font-semibold text-zinc-100 sm:text-2xl">Memória</h1>
        </div>
        <p className="mt-0.5 text-sm text-zinc-500">
          Histórico persistente de recomendações e ações da Aura
        </p>
        <Link
          href="/dashboard"
          className="mt-2 inline-block text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ← Voltar à visão geral
        </Link>
      </div>
      <MemoriaView />
    </div>
  );
}
