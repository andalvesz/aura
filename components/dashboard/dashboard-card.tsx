import Link from "next/link";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/dashboard/panel";
import { EmptyState } from "@/components/dashboard/empty-state";
import { cn } from "@/utils/cn";
import type { DashboardBlockStatus } from "@/lib/supabase/services/personal-dashboard.service";

type DashboardCardProps = {
  title: string;
  status: DashboardBlockStatus;
  error?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  href?: string;
  children?: React.ReactNode;
  className?: string;
  testId?: string;
};

export function DashboardCard({
  title,
  status,
  error,
  emptyTitle = "Sem dados ainda",
  emptyDescription,
  emptyAction,
  href,
  children,
  className,
  testId = "dashboard-card",
}: DashboardCardProps) {
  return (
    <Panel className={cn("flex flex-col", className)} data-testid={testId}>
      <PanelHeader>
        <PanelTitle>{title}</PanelTitle>
        {href ? (
          <Link
            href={href}
            className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Abrir
          </Link>
        ) : null}
      </PanelHeader>
      <PanelContent className="flex-1 pt-2">
        {status === "loading" ? (
          <p className="py-4 text-center text-[12px] text-zinc-600" role="status">
            Carregando…
          </p>
        ) : status === "error" ? (
          <DashboardError message={error ?? "Não foi possível carregar este bloco."} />
        ) : status === "empty" ? (
          <DashboardEmptyState
            title={emptyTitle}
            description={emptyDescription}
            action={emptyAction}
          />
        ) : (
          children
        )}
      </PanelContent>
    </Panel>
  );
}

export function DashboardEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return <EmptyState title={title} description={description} action={action} />;
}

export function DashboardLoading({ label = "Carregando painel…" }: { label?: string }) {
  return (
    <div
      className="space-y-3"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="dashboard-loading"
    >
      <p className="sr-only">{label}</p>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-lg border border-white/[0.06] bg-zinc-900/40"
        />
      ))}
    </div>
  );
}

export function DashboardError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-3 text-[12px] text-rose-300"
      data-testid="dashboard-error"
    >
      {message}
    </div>
  );
}
