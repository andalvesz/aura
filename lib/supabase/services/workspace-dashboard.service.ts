import { canManageMembers, canDeleteWorkspace } from "@/lib/workspace/constants";
import { requireWorkspaceContext } from "@/lib/supabase/services/context";
import {
  listClientes,
  listOrcamentos,
  listEstoqueCritico,
} from "@/lib/supabase/services/alvesz.service";
import {
  listWorkspaceMembers,
  listWorkspaceInvites,
} from "@/lib/supabase/services/workspace.service";
import { normalizeOrcamentoStatus } from "@/utils/alvesz-integration";
import type { AlveszEvento, AlveszProposta, WorkspaceRole } from "@/types/database";
import type { DashboardBlock } from "@/lib/supabase/services/personal-dashboard.service";

function okBlock<T>(data: T, isEmpty: boolean): DashboardBlock<T> {
  if (isEmpty) return { status: "empty", data, error: null };
  return { status: "ok", data, error: null };
}

function errBlock<T>(error: string): DashboardBlock<T> {
  return { status: "error", data: null, error };
}

export type WorkspaceOpsSummary = {
  workspaceName: string;
  workspaceSlug: string;
  role: WorkspaceRole;
  upcomingEvents: { id: string; titulo: string; data: string }[];
  recentLeads: { id: string; nome: string; status: string }[];
  openPropostas: number;
  activeClientes: number;
  alerts: string[];
};

export type WorkspaceCommercialSummary = {
  openPropostas: number;
  estimatedValue: number | null;
  approvedCount: number;
  conversionPct: number | null;
  registeredRevenue: number;
  recentOrcamentos: {
    id: string;
    label: string;
    status: string;
    valor: number;
  }[];
};

export type WorkspaceCrmSummary = {
  recentLeads: { id: string; nome: string; status: string }[];
  leadsByStatus: { status: string; count: number }[];
  clientesCount: number;
  followUpsPending: number;
};

export type WorkspaceAlveszSummary = {
  upcomingEvents: { id: string; titulo: string; data: string }[];
  propostasCount: number;
  recentPdfs: { id: string; label: string; ready: boolean }[];
  estoqueAlerts: { id: string; produto: string; quantidade: number }[];
  clientesCount: number;
};

export type WorkspaceGrowthSummary = {
  note: string;
  availableInPersonal: boolean;
};

export type WorkspaceTeamSummary = {
  members: { id: string; role: string; userId: string }[];
  pendingInvites: number;
  canManage: boolean;
  canOwnerActions: boolean;
};

export type WorkspaceDashboardSummary = {
  mode: "workspace";
  workspaceId: string;
  role: WorkspaceRole;
  ops: DashboardBlock<WorkspaceOpsSummary>;
  commercial: DashboardBlock<WorkspaceCommercialSummary>;
  crm: DashboardBlock<WorkspaceCrmSummary>;
  alvesz: DashboardBlock<WorkspaceAlveszSummary>;
  growth: DashboardBlock<WorkspaceGrowthSummary>;
  team: DashboardBlock<WorkspaceTeamSummary>;
};

/**
 * Aggregated WORKSPACE dashboard — only the validated active workspace.
 * Uses requireWorkspaceContext (never trusts client workspace_id alone).
 */
export async function getWorkspaceDashboardSummary(): Promise<WorkspaceDashboardSummary> {
  const ctx = await requireWorkspaceContext();
  const { supabase, activeWorkspaceId, workspaceRole } = ctx;

  const [
    clientesRes,
    orcamentosRes,
    estoqueCriticoRes,
    membersRes,
    invitesRes,
    eventosRes,
    propostasRes,
    workspaceRow,
  ] = await Promise.all([
    listClientes().catch((e) => ({ data: null, error: String(e) })),
    listOrcamentos().catch((e) => ({ data: null, error: String(e) })),
    listEstoqueCritico().catch((e) => ({ data: null, error: String(e) })),
    listWorkspaceMembers(activeWorkspaceId).catch((e) => ({
      data: null,
      error: String(e),
    })),
    listWorkspaceInvites(activeWorkspaceId).catch((e) => ({
      data: null,
      error: String(e),
    })),
    supabase
      .from("alvesz_eventos")
      .select("id, titulo, data_evento")
      .eq("workspace_id", activeWorkspaceId)
      .order("data_evento", { ascending: true })
      .limit(20),
    supabase
      .from("alvesz_propostas")
      .select("id, orcamento_id, pdf_meta, created_at, updated_at")
      .eq("workspace_id", activeWorkspaceId)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("workspaces")
      .select("id, name, slug")
      .eq("id", activeWorkspaceId)
      .maybeSingle(),
  ]);

  const clientes = (clientesRes.data ?? []) as { id: string; nome: string }[];
  const orcamentos = (orcamentosRes.data ?? []) as {
    id: string;
    tipo_evento: string;
    status: string;
    valor_total: number;
    data_evento?: string | null;
  }[];
  // Consórcios module removed — CRM uses Alvesz clientes (not legacy public.leads)
  const leads: { id: string; nome: string; status: string; updated_at: string }[] = [];
  const leadsRes = { error: null as string | null };
  const estoqueCritico = (estoqueCriticoRes.data ?? []) as {
    id: string;
    produto: string;
    quantidade: number;
  }[];
  const members = (membersRes.data ?? []) as {
    id: string;
    role: string;
    user_id: string;
    status: string;
  }[];
  const invites = (invitesRes.data ?? []) as { id: string; accepted_at: string | null }[];
  const eventos = (eventosRes.data ?? []) as Pick<
    AlveszEvento,
    "id" | "titulo" | "data_evento"
  >[];
  const propostas = (propostasRes.data ?? []) as Pick<
    AlveszProposta,
    "id" | "orcamento_id" | "pdf_meta" | "created_at" | "updated_at"
  >[];

  const today = new Date().toISOString().slice(0, 10);
  const upcomingEvents = eventos
    .filter((e) => e.data_evento >= today)
    .slice(0, 6)
    .map((e) => ({ id: e.id, titulo: e.titulo, data: e.data_evento }));

  const openStatuses = new Set(["rascunho", "enviado", "negociacao"]);
  const openOrcs = orcamentos.filter((o) =>
    openStatuses.has(normalizeOrcamentoStatus(o.status))
  );
  const closedOrcs = orcamentos.filter(
    (o) => normalizeOrcamentoStatus(o.status) === "fechado"
  );
  const decided = orcamentos.filter((o) => {
    const s = normalizeOrcamentoStatus(o.status);
    return s === "fechado" || s === "perdido";
  });
  const estimatedValue =
    openOrcs.length > 0
      ? openOrcs.reduce((s, o) => s + Number(o.valor_total || 0), 0)
      : null;
  const registeredRevenue = closedOrcs.reduce(
    (s, o) => s + Number(o.valor_total || 0),
    0
  );
  const conversionPct =
    decided.length > 0
      ? Math.round((closedOrcs.length / decided.length) * 100)
      : null;

  const openPropostas = propostas.filter((p) => {
    const meta = p.pdf_meta as { ready?: boolean } | null;
    return !meta?.ready;
  }).length;

  const alerts: string[] = [];
  if (estoqueCritico.length > 0) {
    alerts.push(`${estoqueCritico.length} item(ns) de estoque abaixo do mínimo`);
  }
  if (openOrcs.length > 5) {
    alerts.push(`${openOrcs.length} orçamentos em aberto`);
  }

  const ops: DashboardBlock<WorkspaceOpsSummary> = workspaceRow.error
    ? errBlock(workspaceRow.error.message)
    : okBlock(
        {
          workspaceName: workspaceRow.data?.name ?? "Workspace",
          workspaceSlug: workspaceRow.data?.slug ?? "",
          role: workspaceRole,
          upcomingEvents,
          recentLeads: leads.slice(0, 5).map((l) => ({
            id: l.id,
            nome: l.nome,
            status: l.status,
          })),
          openPropostas: propostas.length,
          activeClientes: clientes.length,
          alerts,
        },
        !workspaceRow.data
      );

  const commercialEmpty =
    orcamentos.length === 0 && propostas.length === 0;
  const commercial: DashboardBlock<WorkspaceCommercialSummary> =
    "error" in orcamentosRes && orcamentosRes.error
      ? errBlock(String(orcamentosRes.error))
      : okBlock(
          {
            openPropostas: openOrcs.length,
            estimatedValue,
            approvedCount: closedOrcs.length,
            conversionPct,
            registeredRevenue,
            recentOrcamentos: orcamentos.slice(0, 6).map((o) => ({
              id: o.id,
              label: o.tipo_evento,
              status: normalizeOrcamentoStatus(o.status),
              valor: Number(o.valor_total || 0),
            })),
          },
          commercialEmpty
        );

  const byStatus = new Map<string, number>();
  for (const l of leads) {
    byStatus.set(l.status, (byStatus.get(l.status) ?? 0) + 1);
  }
  const crm: DashboardBlock<WorkspaceCrmSummary> =
    "error" in leadsRes && leadsRes.error
      ? errBlock(String(leadsRes.error))
      : okBlock(
          {
            recentLeads: leads.slice(0, 8).map((l) => ({
              id: l.id,
              nome: l.nome,
              status: l.status,
            })),
            leadsByStatus: [...byStatus.entries()].map(([status, count]) => ({
              status,
              count,
            })),
            clientesCount: clientes.length,
            followUpsPending: leads.filter((l) =>
              ["novo", "contato", "negociacao", "pendente"].includes(l.status)
            ).length,
          },
          leads.length === 0 && clientes.length === 0
        );

  const recentPdfs = propostas
    .filter((p) => {
      const meta = p.pdf_meta as { ready?: boolean; storagePath?: string } | null;
      return Boolean(meta?.ready || meta?.storagePath);
    })
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      label: `Proposta ${p.id.slice(0, 8)}`,
      ready: Boolean((p.pdf_meta as { ready?: boolean } | null)?.ready),
    }));

  const alvesz: DashboardBlock<WorkspaceAlveszSummary> = okBlock(
    {
      upcomingEvents,
      propostasCount: propostas.length,
      recentPdfs,
      estoqueAlerts: estoqueCritico.slice(0, 5).map((e) => ({
        id: e.id,
        produto: e.produto,
        quantidade: e.quantidade,
      })),
      clientesCount: clientes.length,
    },
    upcomingEvents.length === 0 &&
      propostas.length === 0 &&
      estoqueCritico.length === 0 &&
      clientes.length === 0
  );

  const growth: DashboardBlock<WorkspaceGrowthSummary> = okBlock(
    {
      note:
        "Conteúdos, Growth leads e campanhas pessoais ficam no contexto Pessoal. Integrações de anúncio só aparecem quando conectadas nos módulos.",
      availableInPersonal: true,
    },
    true
  );

  const pendingInvites =
    invitesRes.error === "forbidden"
      ? 0
      : invites.filter((i) => !i.accepted_at).length;
  const team: DashboardBlock<WorkspaceTeamSummary> =
    "error" in membersRes && membersRes.error
      ? errBlock(String(membersRes.error))
      : okBlock(
          {
            members: members
              .filter((m) => m.status === "active")
              .map((m) => ({
                id: m.id,
                role: m.role,
                userId: m.user_id,
              })),
            pendingInvites,
            canManage: canManageMembers(workspaceRole),
            canOwnerActions: canDeleteWorkspace(workspaceRole),
          },
          members.length === 0
        );

  return {
    mode: "workspace",
    workspaceId: activeWorkspaceId,
    role: workspaceRole,
    ops,
    commercial,
    crm,
    alvesz,
    growth,
    team,
  };
}
