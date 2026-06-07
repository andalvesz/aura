import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { BusinessIntelligenceView } from "@/components/dashboard/modules/business-intelligence-view";

export default function BusinessIntelligencePage() {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5 text-violet-400" />
          <h1 className="text-xl font-semibold text-zinc-100 sm:text-2xl">
            Business Intelligence
          </h1>
        </div>
        <p className="mt-0.5 text-sm text-zinc-500">
          Análise cross-domain com insights, oportunidades, alertas e recomendações a partir dos
          seus dados reais
        </p>
        <Link
          href="/dashboard"
          className="mt-2 inline-block text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          ← Voltar à visão geral
        </Link>
      </div>
      <BusinessIntelligenceView />
    </div>
  );
}
