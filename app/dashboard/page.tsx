import { ModuleOverviewGrid } from "@/components/dashboard/module-overview-grid";
import { Panel, PanelContent } from "@/components/dashboard/panel";

export default function DashboardPage() {
  return (
    <div className="space-y-3">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-600">
          Aura OS
        </p>
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-50">
          Visão geral
        </h1>
        <p className="mt-0.5 max-w-2xl text-[12px] text-zinc-500">
          Sistema operacional pessoal de Anderson Alves — dinheiro, agenda,
          empresa, saúde, conteúdo e vendas em um só lugar.
        </p>
      </header>
      <ModuleOverviewGrid />
      <Panel>
        <PanelContent className="py-3">
          <p className="text-[12px] text-zinc-500">
            <span className="text-zinc-400">Dica:</span> Selecione um módulo na
            sidebar ou nos cards acima. Dados mockados — integração com Supabase
            em breve.
          </p>
        </PanelContent>
      </Panel>
    </div>
  );
}
