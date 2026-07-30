/**
 * Validates that personal communication_logs only reference entities
 * the actor can access (workspace membership or own personal rows).
 */

export type WorkspaceRefCheck = {
  table: "clientes" | "orcamentos" | "alvesz_propostas" | "leads" | "alvesz_eventos";
  id: string;
  workspaceId: string | null;
};

export type PersonalRefCheck = {
  table: "growth_leads";
  id: string;
  ownerUserId: string | null;
};

export type CommLogRefInput = {
  actorUserId: string;
  isActiveMemberOf: (workspaceId: string) => boolean;
  cliente?: WorkspaceRefCheck | null;
  orcamento?: WorkspaceRefCheck | null;
  proposta?: WorkspaceRefCheck | null;
  leadWorkspace?: WorkspaceRefCheck | null;
  growthLead?: PersonalRefCheck | null;
  evento?: WorkspaceRefCheck | null;
};

export type CommLogRefViolation =
  | "cliente_inaccessible"
  | "orcamento_inaccessible"
  | "proposta_inaccessible"
  | "lead_inaccessible"
  | "growth_lead_inaccessible"
  | "evento_inaccessible"
  | "cliente_missing"
  | "orcamento_missing"
  | "proposta_missing"
  | "lead_missing"
  | "growth_lead_missing"
  | "evento_missing";

function checkWorkspaceRef(
  ref: WorkspaceRefCheck | null | undefined,
  missingCode: CommLogRefViolation,
  inaccessibleCode: CommLogRefViolation,
  isActiveMemberOf: (workspaceId: string) => boolean
): CommLogRefViolation | null {
  if (!ref) return null;
  if (!ref.workspaceId) return missingCode;
  if (!isActiveMemberOf(ref.workspaceId)) return inaccessibleCode;
  return null;
}

/**
 * Pure validation used by service layer and unit tests.
 * Pass null for optional refs that were not set on the log payload.
 * Pass a check object when the FK id was provided (resolved from DB).
 */
export function validateCommunicationLogRefs(
  input: CommLogRefInput
): { ok: true } | { ok: false; violations: CommLogRefViolation[] } {
  const violations: CommLogRefViolation[] = [];
  const { isActiveMemberOf } = input;

  const clienteViolation = checkWorkspaceRef(
    input.cliente,
    "cliente_missing",
    "cliente_inaccessible",
    isActiveMemberOf
  );
  if (clienteViolation) violations.push(clienteViolation);

  const orcamentoViolation = checkWorkspaceRef(
    input.orcamento,
    "orcamento_missing",
    "orcamento_inaccessible",
    isActiveMemberOf
  );
  if (orcamentoViolation) violations.push(orcamentoViolation);

  const propostaViolation = checkWorkspaceRef(
    input.proposta,
    "proposta_missing",
    "proposta_inaccessible",
    isActiveMemberOf
  );
  if (propostaViolation) violations.push(propostaViolation);

  const leadWsViolation = checkWorkspaceRef(
    input.leadWorkspace,
    "lead_missing",
    "lead_inaccessible",
    isActiveMemberOf
  );
  if (leadWsViolation) violations.push(leadWsViolation);

  const eventoViolation = checkWorkspaceRef(
    input.evento,
    "evento_missing",
    "evento_inaccessible",
    isActiveMemberOf
  );
  if (eventoViolation) violations.push(eventoViolation);

  if (input.growthLead) {
    if (!input.growthLead.ownerUserId) {
      violations.push("growth_lead_missing");
    } else if (input.growthLead.ownerUserId !== input.actorUserId) {
      violations.push("growth_lead_inaccessible");
    }
  }

  if (violations.length > 0) return { ok: false, violations };
  return { ok: true };
}

/** True when another user cannot read a personal communication_log row. */
export function canReadCommunicationLog(params: {
  actorUserId: string;
  rowUserId: string;
}): boolean {
  return params.actorUserId === params.rowUserId;
}
