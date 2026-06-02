import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Evento, Orcamento } from "../types/database";
import {
  computeAlveszMetrics,
  filterAlveszEventos,
  filterFollowUpEventos,
  isNexusAlveszQuery,
  isNexusCalendarQuery,
  isNexusDashboardQuery,
} from "./nexus";

describe("nexus query detection", () => {
  it("detects alvesz queries", () => {
    assert.equal(isNexusAlveszQuery("Como está o pipeline da Alvesz?"), true);
    assert.equal(isNexusAlveszQuery("meu dia"), false);
    assert.equal(isNexusAlveszQuery("", "alvesz-resumo"), true);
  });

  it("detects calendar queries", () => {
    assert.equal(isNexusCalendarQuery("Quais follow-ups tenho esta semana?"), true);
    assert.equal(isNexusCalendarQuery("analisar leads"), false);
    assert.equal(isNexusCalendarQuery("", "calendario-hoje"), true);
  });

  it("detects dashboard queries", () => {
    assert.equal(isNexusDashboardQuery("dashboard executivo"), true);
    assert.equal(isNexusDashboardQuery("meu dia"), false);
    assert.equal(isNexusDashboardQuery("", "dashboard-executivo"), true);
  });
});

describe("nexus data helpers", () => {
  const eventos: Evento[] = [
    {
      id: "1",
      user_id: "u",
      titulo: "Follow-up leads consórcio",
      descricao: null,
      data_inicio: new Date(Date.now() + 86400000).toISOString(),
      data_fim: null,
      local: null,
      tipo: "vendas",
      created_at: "",
      updated_at: "",
    },
    {
      id: "2",
      user_id: "u",
      titulo: "Treino",
      descricao: null,
      data_inicio: new Date(Date.now() + 86400000 * 2).toISOString(),
      data_fim: null,
      local: null,
      tipo: "saude",
      created_at: "",
      updated_at: "",
    },
    {
      id: "3",
      user_id: "u",
      titulo: "Evento corporativo Alvesz",
      descricao: null,
      data_inicio: new Date(Date.now() + 86400000 * 3).toISOString(),
      data_fim: null,
      local: null,
      tipo: "trabalho",
      created_at: "",
      updated_at: "",
    },
  ];

  it("filters alvesz-related eventos", () => {
    const alvesz = filterAlveszEventos(eventos);
    assert.equal(alvesz.length, 1);
    assert.match(alvesz[0].titulo, /Alvesz/i);
  });

  it("filters follow-up eventos", () => {
    const followUps = filterFollowUpEventos(eventos);
    assert.equal(followUps.length, 1);
    assert.match(followUps[0].titulo, /follow-up/i);
  });

  it("computes alvesz metrics", () => {
    const orcamentos = [
      {
        id: "o1",
        user_id: "u",
        cliente_id: null,
        tipo_evento: "Casamento",
        convidados: 100,
        valor_total: 10000,
        lucro_estimado: 3800,
        status: "pendente",
        created_at: "",
        updated_at: "",
        clientes: null,
      },
      {
        id: "o2",
        user_id: "u",
        cliente_id: null,
        tipo_evento: "Corporativo",
        convidados: 50,
        valor_total: 5000,
        lucro_estimado: 1900,
        status: "aprovado",
        created_at: "",
        updated_at: "",
        clientes: null,
      },
    ] as (Orcamento & { clientes: null })[];

    const metrics = computeAlveszMetrics(orcamentos);
    assert.equal(metrics.pendentes, 1);
    assert.equal(metrics.aprovados, 1);
    assert.equal(metrics.pipelinePendente, 10000);
    assert.equal(metrics.receitaAprovada, 5000);
  });
});
