import { BaseRepository } from "@/lib/supabase/repositories";
import {
  createCliente,
  createOrcamento,
  listClientes,
} from "@/lib/supabase/services/alvesz.service";
import {
  createEvento,
  deleteEvento,
  listEventos,
  updateEvento,
} from "@/lib/supabase/services/eventos.service";
import { createFinancialIncome } from "@/lib/supabase/services/finance.service";
import { createGasto } from "@/lib/supabase/services/gastos.service";
import {
  createGrowthLead,
  listGrowthLeads,
  updateGrowthLead,
} from "@/lib/supabase/services/growth.service";
import { getDataContext } from "@/lib/supabase/services/context";
import { awardAuraXp } from "@/lib/supabase/services/xp.service";
import { calcLucroEstimado } from "@/utils/alvesz";
import {
  buildEventoDateTime,
  eventoPayloadFromSuggestion,
  type ParsedEventoSuggestion,
} from "@/utils/calendar";
import type { AuraCommandId, AuraCommandPayload, PendingAuraCommand } from "@/utils/aura-commands";
import { exerciciosToJson, todayIsoDate } from "@/utils/health";
import type { GrowthLead, GrowthLeadCanal, GrowthVertical } from "@/types/database";

function findEventoByRef(
  eventos: Awaited<ReturnType<typeof listEventos>>["data"],
  payload: AuraCommandPayload
) {
  const list = eventos ?? [];
  if (payload.evento_id) {
    return list.find((e) => e.id === payload.evento_id) ?? null;
  }
  const busca = String(payload.titulo_busca ?? payload.titulo ?? "")
    .toLowerCase()
    .trim();
  if (!busca) return null;
  return (
    list.find((e) => (e.titulo ?? "").toLowerCase().includes(busca)) ??
    list.find((e) => busca.includes((e.titulo ?? "").toLowerCase())) ??
    null
  );
}

function findLeadByRef(leads: GrowthLead[], payload: AuraCommandPayload): GrowthLead | null {
  if (payload.lead_id) {
    return leads.find((l) => l.id === payload.lead_id) ?? null;
  }
  const busca = String(payload.nome_busca ?? payload.nome ?? "")
    .toLowerCase()
    .trim();
  if (!busca) return null;
  return (
    leads.find((l) => l.nome.toLowerCase().includes(busca)) ??
    leads.find((l) => busca.includes(l.nome.toLowerCase())) ??
    null
  );
}

async function resolveClienteId(
  payload: AuraCommandPayload
): Promise<string | null> {
  if (payload.cliente_id) return String(payload.cliente_id);

  const nome = String(payload.cliente_nome ?? "").trim();
  if (!nome) return null;

  const { data: clientes } = await listClientes();
  const match = (clientes ?? []).find((c) =>
    c.nome.toLowerCase().includes(nome.toLowerCase())
  );
  return match?.id ?? null;
}

async function upsertFinancialBalance(valor: number) {
  const { supabase, userId } = await getDataContext();

  const { data: existing } = await supabase
    .from("financial_balance")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("financial_balance")
      .update({ valor_atual: valor })
      .eq("id", existing.id)
      .eq("user_id", userId)
      .select()
      .single();
    return { data, error: error?.message ?? null };
  }

  const { data, error } = await supabase
    .from("financial_balance")
    .insert({ user_id: userId, valor_atual: valor })
    .select()
    .single();

  return { data, error: error?.message ?? null };
}

export async function executeAuraCommand(
  pending: PendingAuraCommand
): Promise<{ result: AuraCommandPayload; error: string | null }> {
  const { commandId, payload } = pending;

  try {
    switch (commandId) {
      case "financeiro.registrar-despesa": {
        const { data, error } = await createGasto({
          titulo: String(payload.titulo),
          valor: Number(payload.valor),
          categoria: String(payload.categoria),
          data: String(payload.data),
        });
        if (error) return { result: {}, error };
        return {
          result: {
            message: `Despesa de R$ ${Number(payload.valor).toFixed(2)} registrada.`,
            id: data?.id,
          },
          error: null,
        };
      }

      case "financeiro.registrar-receita": {
        const { data, error } = await createFinancialIncome({
          descricao: String(payload.descricao),
          valor: Number(payload.valor),
          origem: payload.origem as "outros",
          data: String(payload.data),
        });
        if (error) return { result: {}, error };
        return {
          result: {
            message: `Receita de R$ ${Number(payload.valor).toFixed(2)} registrada.`,
            id: data?.id,
          },
          error: null,
        };
      }

      case "financeiro.definir-saldo": {
        const valor = Number(payload.valor_atual);
        const { error } = await upsertFinancialBalance(valor);
        if (error) return { result: {}, error };
        return {
          result: { message: `Saldo definido em R$ ${valor.toFixed(2)}.` },
          error: null,
        };
      }

      case "calendario.criar-evento": {
        const suggestion: ParsedEventoSuggestion = {
          titulo: String(payload.titulo),
          descricao: payload.descricao ? String(payload.descricao) : null,
          data: String(payload.data),
          hora: String(payload.hora),
          tipo: String(payload.tipo),
        };
        const { data, error } = await createEvento(
          eventoPayloadFromSuggestion(suggestion)
        );
        if (error) return { result: {}, error };
        return {
          result: { message: `Evento "${suggestion.titulo}" criado.`, id: data?.id },
          error: null,
        };
      }

      case "calendario.remarcar-evento":
      case "calendario.cancelar-evento": {
        const { data: eventos, error: listError } = await listEventos();
        if (listError) return { result: {}, error: listError };

        const evento = findEventoByRef(eventos, payload);
        if (!evento) {
          return { result: {}, error: "Evento não encontrado. Tente com outro título." };
        }

        if (commandId === "calendario.cancelar-evento") {
          const { error } = await deleteEvento(evento.id);
          if (error) return { result: {}, error };
          return {
            result: { message: `Evento "${evento.titulo}" cancelado.` },
            error: null,
          };
        }

        const data = String(payload.data ?? "").slice(0, 10);
        const hora = String(payload.hora ?? "09:00").slice(0, 5);
        const { error } = await updateEvento(evento.id, {
          data_inicio: buildEventoDateTime(data, hora),
        });
        if (error) return { result: {}, error };
        return {
          result: { message: `Evento "${evento.titulo}" remarcado.` },
          error: null,
        };
      }

      case "crescimento.criar-lead": {
        const { data, error } = await createGrowthLead({
          nome: String(payload.nome),
          contato: payload.contato ? String(payload.contato) : null,
          origem: String(payload.origem ?? "Aura Central"),
          canal: (payload.canal as GrowthLeadCanal) ?? "outro",
          vertical: (payload.vertical as GrowthVertical | null) ?? null,
          status: (payload.status as GrowthLead["status"]) ?? "novo",
          valor_potencial: Number(payload.valor_potencial) || 0,
          observacoes: payload.observacoes ? String(payload.observacoes) : null,
        });
        if (error) return { result: {}, error };
        return {
          result: { message: `Lead "${payload.nome}" criado.`, id: data?.id },
          error: null,
        };
      }

      case "crescimento.atualizar-lead":
      case "crescimento.fechar-lead": {
        const { data: leads, error: listError } = await listGrowthLeads();
        if (listError) return { result: {}, error: listError };

        const lead = findLeadByRef((leads ?? []) as GrowthLead[], payload);
        if (!lead) {
          return { result: {}, error: "Lead não encontrado." };
        }

        const status =
          commandId === "crescimento.fechar-lead"
            ? "fechado"
            : (payload.status as GrowthLead["status"]);

        const { error } = await updateGrowthLead(lead.id, {
          status,
          ...(payload.valor_potencial != null
            ? { valor_potencial: Number(payload.valor_potencial) }
            : {}),
          ...(payload.observacoes != null
            ? { observacoes: String(payload.observacoes) }
            : {}),
        });
        if (error) return { result: {}, error };
        return {
          result: { message: `Lead "${lead.nome}" atualizado.` },
          error: null,
        };
      }

      case "alvesz.criar-cliente": {
        const { data, error } = await createCliente({
          nome: String(payload.nome),
          telefone: payload.telefone ? String(payload.telefone) : null,
          email: null,
          instagram: payload.instagram ? String(payload.instagram) : null,
          tipo: "pessoa_fisica",
          observacoes: payload.observacoes ? String(payload.observacoes) : null,
        });
        if (error) return { result: {}, error };
        return {
          result: { message: `Cliente "${payload.nome}" criado.`, id: data?.id },
          error: null,
        };
      }

      case "alvesz.criar-orcamento": {
        const clienteId = await resolveClienteId(payload);
        const valorTotal = Number(payload.valor_total) || 0;
        const { data, error } = await createOrcamento({
          cliente_id: clienteId,
          tipo_evento: String(payload.tipo_evento),
          convidados: Number(payload.convidados) || 50,
          valor_total: valorTotal,
          lucro_estimado:
            Number(payload.lucro_estimado) || calcLucroEstimado(valorTotal),
          status: String(payload.status ?? "rascunho"),
          data_evento: payload.data_evento ? String(payload.data_evento) : null,
          local: payload.local ? String(payload.local) : null,
          observacoes: null,
        });
        if (error) return { result: {}, error };
        return {
          result: { message: "Orçamento Alvesz criado.", id: data?.id },
          error: null,
        };
      }

      case "alvesz.criar-evento": {
        const { supabase, userId } = await getDataContext();
        const clienteId = await resolveClienteId(payload);
        const { data, error } = await new BaseRepository(
          supabase,
          "alvesz_eventos",
          userId
        ).create({
          titulo: String(payload.titulo),
          data_evento: String(payload.data_evento),
          local: payload.local ? String(payload.local) : null,
          cliente_id: clienteId,
          valor_fechado: Number(payload.valor_fechado) || 0,
        });
        if (error) return { result: {}, error };
        return {
          result: { message: `Evento Alvesz "${payload.titulo}" criado.`, id: data?.id },
          error: null,
        };
      }

      case "saude.criar-treino": {
        const { supabase, userId } = await getDataContext();
        const exercicios = Array.isArray(payload.exercicios) ? payload.exercicios : [];
        const { data, error } = await new BaseRepository(
          supabase,
          "health_workouts",
          userId
        ).create({
          nome: String(payload.nome),
          grupo_muscular: String(payload.grupo_muscular ?? "Geral"),
          exercicios: exerciciosToJson(
            exercicios as Parameters<typeof exerciciosToJson>[0]
          ),
          duracao_min: Number(payload.duracao_min) || 45,
          observacoes: payload.observacoes ? String(payload.observacoes) : null,
          data: todayIsoDate(),
        });
        if (error) return { result: {}, error };
        await awardAuraXp("completar_treino");
        return {
          result: { message: `Treino "${payload.nome}" salvo em Saúde.`, id: data?.id },
          error: null,
        };
      }

      case "saude.criar-habito": {
        const { supabase, userId } = await getDataContext();
        const status = String(payload.status ?? "pendente");
        const { data, error } = await new BaseRepository(
          supabase,
          "health_habits",
          userId
        ).create({
          titulo: String(payload.titulo),
          frequencia: String(payload.frequencia ?? "diario"),
          status,
          data: todayIsoDate(),
        });
        if (error) return { result: {}, error };
        if (status === "concluido") {
          await awardAuraXp("completar_habito");
        }
        return {
          result: { message: `Hábito "${payload.titulo}" criado.`, id: data?.id },
          error: null,
        };
      }

      case "saude.criar-refeicao": {
        const { supabase, userId } = await getDataContext();
        const { data, error } = await new BaseRepository(
          supabase,
          "health_meals",
          userId
        ).create({
          nome: String(payload.nome),
          horario: String(payload.horario ?? "12:00"),
          alimentos: payload.alimentos ? String(payload.alimentos) : null,
          calorias: payload.calorias != null ? Number(payload.calorias) : null,
          observacoes: null,
          data: todayIsoDate(),
        });
        if (error) return { result: {}, error };
        return {
          result: { message: `Refeição "${payload.nome}" registrada.`, id: data?.id },
          error: null,
        };
      }

      default:
        return { result: {}, error: "Comando não suportado." };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao executar comando.";
    return { result: {}, error: message };
  }
}
