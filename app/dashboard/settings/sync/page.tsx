import { SyncPanel } from "@/components/dashboard/smart-capture/sync-panel";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";

export default function SyncSettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4" data-testid="sync-settings-page">
      <PageBreadcrumb
        items={[
          { label: "Configurações", href: "/dashboard/settings" },
          { label: "Sincronizações" },
        ]}
      />
      <div>
        <h1 className="text-lg font-medium text-zinc-100">Sincronizações</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Fila offline do Smart Capture — pendentes, enviadas e falhas.
        </p>
      </div>
      <SyncPanel />
    </div>
  );
}
