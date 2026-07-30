/**
 * World Model V1 — public surface.
 */

export type * from "@/lib/world-model/types";

export {
  getEntityTypeDefinition,
  listEntityTypes,
  isKnownEntityType,
  assertEntityType,
  filterAllowedAttributes,
} from "@/lib/world-model/entity-registry";

export {
  getRelationshipTypeDefinition,
  listRelationshipTypes,
  isKnownRelationshipType,
  assertRelationshipCompatibility,
} from "@/lib/world-model/relationship-registry";

export {
  clampScore,
  confidenceBand,
  sourceTrustBaseline,
  isIsolatedSource,
  initialEntityConfidence,
  initialRelationshipConfidence,
  projectionConfidenceFrom,
} from "@/lib/world-model/confidence";

export {
  assertWorldPrivacy,
  isRestrictedText,
  worldVisibleInScope,
} from "@/lib/world-model/privacy";

export {
  buildCanonicalKey,
  findEntityCandidates,
  resolveEntity,
  sameDisplayNameIsNotSameEntity,
} from "@/lib/world-model/resolution";

export {
  createEmptyWorldState,
  createWorldEntityPure,
  createWorldRelationshipPure,
  getWorldEntityPure,
  listWorldEntitiesPure,
  searchWorldEntitiesPure,
  getEntityNeighborsPure,
  getEntityRelationshipsPure,
  getRelationshipPure,
  findPathPure,
  explainEntityPure,
  explainRelationshipPure,
  getRelationshipTimelinePure,
  confirmRelationshipPure,
  rejectRelationshipPure,
  correctRelationshipPure,
  archiveEntityPure,
  archiveRelationshipPure,
  mergeEntitiesPure,
  correctEntityProjectionPure,
  getWorldContextForBrainPure,
  reconcileEntityFromSourcePure,
  emptyProjectionReport,
} from "@/lib/world-model/engine";

export type { WorldModelState, EngineResult } from "@/lib/world-model/engine";

export { applyBootstrapToWorldState } from "@/lib/world-model/bootstrap";
export type {
  WorldBootstrapInput,
  WorldBootstrapReport,
} from "@/lib/world-model/bootstrap";

export {
  getWorldState,
  setWorldState,
  clearWorldState,
  invalidateWorldCache,
  listWorldAudits,
  worldCacheKey,
  getCachedWorldRead,
  setCachedWorldRead,
} from "@/lib/world-model/store";

export { projectMemoryToWorldModelPure } from "@/lib/world-model/projectors/memory.projector";
export { projectIdentityToWorldModelPure } from "@/lib/world-model/projectors/identity.projector";
export { projectMissionToWorldModelPure } from "@/lib/world-model/projectors/mission.projector";
export { projectBusinessToWorldModelPure } from "@/lib/world-model/projectors/business.projector";
export { projectDocumentToWorldModelPure } from "@/lib/world-model/projectors/document.projector";
