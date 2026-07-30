import { SystemStatusPage } from "@/components/system/system-status-page";

export default function OfflinePage() {
  return (
    <SystemStatusPage
      code="offline"
      title="Você está offline"
      description="Sem conexão com a internet. Algumas capturas podem ficar na fila local até a sincronização. Reconecte e atualize a página."
      primaryHref="/dashboard"
      primaryLabel="Tentar abrir o dashboard"
      secondaryHref="/dashboard/settings/sync"
      secondaryLabel="Fila de sync"
      testId="offline-page"
    />
  );
}
