import { BaseRepository } from "@/lib/supabase/repositories";
import { listEventos } from "@/lib/supabase/services/eventos.service";
import { listGrowthLeads } from "@/lib/supabase/services/growth.service";
import { listClientes } from "@/lib/supabase/services/alvesz.service";
import { getOptionalDataContext } from "@/lib/supabase/services/context";
import { splitEventoDateTime } from "@/utils/calendar";

export type AuraCommandParseContext = {
  eventos: { id: string; titulo: string; data: string; hora: string }[];
  leads: { id: string; nome: string; status: string }[];
  clientes: { id: string; nome: string }[];
};

export async function loadAuraCommandParseContext(): Promise<{
  context: AuraCommandParseContext | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { context: null, error: "Usuário não autenticado." };
  }

  const [eventosRes, leadsRes, clientesRes] = await Promise.all([
    listEventos(),
    listGrowthLeads(),
    listClientes(),
  ]);

  const error = eventosRes.error ?? leadsRes.error ?? clientesRes.error ?? null;
  if (error) {
    return { context: null, error };
  }

  const eventos = (eventosRes.data ?? []).map((e) => {
    const { data, hora } = splitEventoDateTime(e.data_inicio);
    return {
      id: e.id,
      titulo: e.titulo ?? "Sem título",
      data,
      hora,
    };
  });

  const leads = (leadsRes.data ?? []).map((l) => ({
    id: l.id,
    nome: l.nome,
    status: l.status,
  }));

  const clientes = (clientesRes.data ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
  }));

  return {
    context: { eventos, leads, clientes },
    error: null,
  };
}

export async function loadAlveszEventosHint(): Promise<string> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return "";

  const { data } = await new BaseRepository(ctx.supabase, "alvesz_eventos", ctx.userId).findAll(
    "data_evento"
  );

  if (!data?.length) return "Nenhum evento Alvesz cadastrado.";

  return data
    .slice(0, 8)
    .map((e) => `- ${e.titulo} (${e.data_evento})`)
    .join("\n");
}
