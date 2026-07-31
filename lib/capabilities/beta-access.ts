/**
 * Re-export beta access store (Sprint 10.1).
 */
export {
  type BetaAccessStatus,
  type BetaAccessRecord,
  clearBetaAccessStore,
  ensureBetaActive,
  getBetaAccess,
  canAccessBeta,
  suspendBetaAccess,
  reactivateBetaAccess,
  inviteBetaUser,
  listBetaAccessAggregated,
} from "@/lib/capabilities/beta-access-store";
