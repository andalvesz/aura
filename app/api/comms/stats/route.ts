import { getCommsDashboardStats } from "@/lib/comms";
import { listClientes } from "@/lib/supabase/services/alvesz.service";
import { listGrowthLeads } from "@/lib/supabase/services/growth.service";
import { OrcamentosRepository } from "@/lib/supabase/repositories";
import { getOptionalDataContext } from "@/lib/supabase/services/context";

export async function GET() {
  try {
    const ctx = await getOptionalDataContext();
    if (!ctx) {
      return Response.json({ error: "Usuário não autenticado." }, { status: 401 });
    }

    const [leadsRes, orcRes, clientesRes] = await Promise.all([
      listGrowthLeads(),
      new OrcamentosRepository(ctx.supabase, ctx.userId).findAll(),
      listClientes(),
    ]);

    const stats = await getCommsDashboardStats(
      leadsRes.data ?? [],
      orcRes.data ?? [],
      clientesRes.data ?? []
    );

    return Response.json(stats);
  } catch (error) {
    console.error("[comms/stats]", error);
    return Response.json({ error: "Erro ao carregar estatísticas." }, { status: 500 });
  }
}
