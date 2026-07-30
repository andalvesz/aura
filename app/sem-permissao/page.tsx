import { SystemStatusPage } from "@/components/system/system-status-page";

export default function SemPermissaoPage() {
  return (
    <SystemStatusPage
      code="403"
      title="Sem permissão"
      description="Você não tem acesso a este workspace ou recurso. Peça um convite ao dono do workspace ou volte ao seu espaço pessoal."
      primaryHref="/dashboard"
      primaryLabel="Voltar ao dashboard"
      secondaryHref="/login"
      secondaryLabel="Trocar de conta"
      testId="forbidden-page"
    />
  );
}
