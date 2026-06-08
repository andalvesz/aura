export type V1StableItemStatus = "done" | "pending";

export type V1StableChecklistItem = {
  id: string;
  title: string;
  impact: string;
  status: V1StableItemStatus;
};

export const V1_STABLE_CHECKLIST: V1StableChecklistItem[] = [
  {
    id: "google-callback",
    title: "Remover callback Google duplicado",
    impact: "Evita OAuth em rota morta e confusão no redirect.",
    status: "done",
  },
  {
    id: "sync-token",
    title: "Corrigir sync token Google",
    impact: "Import incremental do Calendar passa a persistir o token.",
    status: "done",
  },
  {
    id: "gmail-scopes",
    title: "Validar escopos Gmail",
    impact: "Comunicação só ativa Gmail quando read+send estão concedidos.",
    status: "done",
  },
  {
    id: "comms-tracking",
    title: "Verificar migration comms_tracking",
    impact: "Pixel de abertura de e-mail depende da RPC mark_communication_opened.",
    status: "done",
  },
  {
    id: "env-example",
    title: "Atualizar .env.example",
    impact: "Onboarding documenta OPENAI_API_KEY e integrações Google.",
    status: "done",
  },
  {
    id: "travel-offline",
    title: "Corrigir checklist offline Travel",
    impact: "Seed do checklist é enfileirado e aplicado ao voltar online.",
    status: "done",
  },
  {
    id: "goals-crud",
    title: "PATCH/DELETE Metas",
    impact: "Metas podem ser editadas e excluídas pela API e UI.",
    status: "done",
  },
  {
    id: "xp-idempotency",
    title: "Idempotência XP",
    impact: "Evita XP duplicado em ações repetidas (ex.: checklist).",
    status: "done",
  },
  {
    id: "google-sync-feedback",
    title: "Feedback erro Google Sync",
    impact: "Usuário vê toast quando push do Calendar falha.",
    status: "done",
  },
  {
    id: "diagnostics-modules",
    title: "Diagnóstico Travel/Idiomas/Comunicação",
    impact: "Diagnóstico cobre módulos que faltavam na auditoria.",
    status: "done",
  },
];

export function getV1StableSummary(items: V1StableChecklistItem[] = V1_STABLE_CHECKLIST) {
  const done = items.filter((i) => i.status === "done").length;
  const pending = items.length - done;
  return { total: items.length, done, pending, complete: pending === 0 };
}
