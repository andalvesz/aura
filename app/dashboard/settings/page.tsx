import Link from "next/link";
import { PageBreadcrumb } from "@/components/dashboard/page-breadcrumb";

const LINKS = [
  {
    href: "/dashboard/settings/aura-brain",
    title: "Aura Brain",
    desc: "Autonomia, auditoria e transparência",
  },
  {
    href: "/dashboard/workspace",
    title: "Workspace",
    desc: "Membros, convites e papéis",
  },
  {
    href: "/dashboard/settings/memory",
    title: "Memórias",
    desc: "Engine de memória e retenção",
  },
  {
    href: "/dashboard/discovery",
    title: "Discovery",
    desc: "Sinais, feedback e bootstrap",
  },
  {
    href: "/dashboard/notificacoes",
    title: "Notificações",
    desc: "Alertas do produto (sem push)",
  },
  {
    href: "/dashboard/perfil",
    title: "Perfil",
    desc: "Nome, estatísticas e atividade",
  },
  {
    href: "/dashboard/settings/identity",
    title: "Privacidade / Identity",
    desc: "Claims e consentimento",
  },
  {
    href: "/dashboard/settings/sync",
    title: "Sincronizações",
    desc: "Fila offline do Smart Capture",
  },
  {
    href: "/dashboard/attachments",
    title: "Anexos",
    desc: "Biblioteca de imagens, PDFs, links e áudios",
  },
  {
    href: "/dashboard/projects",
    title: "Projetos",
    desc: "Projects OS — kanban, docs, discovery",
  },
  {
    href: "/dashboard/business",
    title: "Business Hub",
    desc: "Empresas e projetos relacionados",
  },
] as const;

export default function SettingsHubPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="settings-hub">
      <PageBreadcrumb
        items={[
          { label: "Meu Dia", href: "/dashboard" },
          { label: "Configurações" },
        ]}
      />
      <div>
        <h1 className="text-lg font-medium text-zinc-100">Configurações</h1>
        <p className="text-[12px] text-zinc-500">
          Preferências, workspace, notificações, privacidade e Discovery —
          centralizadas.
        </p>
      </div>
      <ul className="space-y-2">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="block rounded-lg border border-white/[0.06] bg-zinc-950/50 px-3 py-3 hover:border-cyan-500/30"
            >
              <p className="text-[13px] text-zinc-100">{l.title}</p>
              <p className="text-[11px] text-zinc-500">{l.desc}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-zinc-600">
        Tema segue o visual do dashboard. Preferências de Discovery ficam em
        atualizar descobertas / feedback — sem Decision Support.
      </p>
    </div>
  );
}
