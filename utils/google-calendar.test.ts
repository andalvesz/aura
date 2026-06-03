import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getEventoGoogleSyncStatus,
  getGoogleSyncStatusLabel,
  GOOGLE_SYNC_STATUS_LABELS,
} from "./google-calendar";
import type { Evento } from "@/types/database";

const baseEvento: Evento = {
  id: "1",
  user_id: "u",
  titulo: "Test",
  descricao: null,
  data_inicio: new Date().toISOString(),
  data_fim: null,
  local: null,
  tipo: "geral",
  growth_lead_id: null,
  google_event_id: null,
  google_sync_status: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("google-calendar utils", () => {
  it("labels sync statuses", () => {
    assert.equal(GOOGLE_SYNC_STATUS_LABELS.synced, "Sincronizado");
    assert.equal(getGoogleSyncStatusLabel("pending"), "Pendente");
    assert.equal(getGoogleSyncStatusLabel(null), null);
  });

  it("reads evento sync status", () => {
    assert.equal(
      getEventoGoogleSyncStatus({ ...baseEvento, google_sync_status: "synced" }),
      "synced"
    );
    assert.equal(getEventoGoogleSyncStatus(baseEvento), null);
  });
});
