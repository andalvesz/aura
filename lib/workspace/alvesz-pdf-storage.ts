/**
 * Alvesz PDF storage — private bucket path helpers and signed URL policy.
 * Canonical path: workspaces/{workspace_id}/propostas/{proposal_id}/{arquivo}
 */

export const ALVESZ_PDF_BUCKET = "alvesz-pdfs";

/** Signed URL TTL for client delivery (seconds). Short by design. */
export const ALVESZ_PDF_SIGNED_URL_TTL_SECONDS = 300;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AlveszPdfPathParts = {
  workspaceId: string;
  proposalId: string;
  filename: string;
};

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function buildAlveszPdfStoragePath(params: {
  workspaceId: string;
  proposalId: string;
  version?: number;
  filename?: string;
}): string {
  const workspaceId = params.workspaceId.trim();
  const proposalId = params.proposalId.trim();
  if (!isUuid(workspaceId) || !isUuid(proposalId)) {
    throw new Error("invalid_alvesz_pdf_path_ids");
  }
  const version = params.version ?? 1;
  const filename =
    params.filename?.trim() ||
    `proposta-v${Math.max(1, Math.floor(version))}.pdf`;
  if (filename.includes("/") || filename.includes("..")) {
    throw new Error("invalid_alvesz_pdf_filename");
  }
  return `workspaces/${workspaceId}/propostas/${proposalId}/${filename}`;
}

export function parseAlveszPdfStoragePath(
  storagePath: string
): AlveszPdfPathParts | null {
  const parts = storagePath.replace(/^\/+/, "").split("/").filter(Boolean);
  if (parts.length !== 5) return null;
  if (parts[0] !== "workspaces" || parts[2] !== "propostas") return null;
  const workspaceId = parts[1]!;
  const proposalId = parts[3]!;
  const filename = parts[4]!;
  if (!isUuid(workspaceId) || !isUuid(proposalId)) return null;
  if (!filename || filename.includes("..")) return null;
  return { workspaceId, proposalId, filename };
}

/** True when path follows the V1 secure layout. */
export function isCanonicalAlveszPdfPath(storagePath: string): boolean {
  return parseAlveszPdfStoragePath(storagePath) !== null;
}

/**
 * Reject client-supplied paths that escape the caller's workspace / proposal.
 * Server must always rebuild the path; this validates any client hint.
 */
export function assertAlveszPdfPathAllowed(params: {
  storagePath: string;
  workspaceId: string;
  proposalId: string;
}): { ok: true } | { ok: false; reason: string } {
  const parsed = parseAlveszPdfStoragePath(params.storagePath);
  if (!parsed) {
    return { ok: false, reason: "path_not_canonical" };
  }
  if (parsed.workspaceId !== params.workspaceId.trim()) {
    return { ok: false, reason: "workspace_mismatch" };
  }
  if (parsed.proposalId !== params.proposalId.trim()) {
    return { ok: false, reason: "proposal_mismatch" };
  }
  return { ok: true };
}

export type LegacyAlveszPdfPathKind =
  | "legacy_user_prefix"
  | "legacy_workspace_prefix"
  | "unknown";

/** Classify non-canonical objects for audit reports (no mutation). */
export function classifyLegacyAlveszPdfPath(storagePath: string): {
  kind: LegacyAlveszPdfPathKind;
  prefix: string | null;
} {
  if (isCanonicalAlveszPdfPath(storagePath)) {
    return { kind: "unknown", prefix: null };
  }
  const parts = storagePath.replace(/^\/+/, "").split("/").filter(Boolean);
  const prefix = parts[0] ?? null;
  if (prefix && isUuid(prefix) && parts.length >= 2) {
    // Ambiguous: could be user_id or workspace_id from earlier layouts
    return { kind: "legacy_workspace_prefix", prefix };
  }
  return { kind: "unknown", prefix };
}
