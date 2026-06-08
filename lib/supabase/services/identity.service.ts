import { resolveUserDisplayName } from "@/lib/supabase/services/context";
import { loadLegacyData } from "@/lib/supabase/services/legado.service";
import type { LegacyData } from "@/utils/legado";
import { buildIdentityContextFromData } from "@/utils/identity";
import { isLegacyEmpty } from "@/utils/legado";
import { getOptionalDataContext } from "./context";

export type UserLegacyContextResult = {
  context: string | null;
  hasLegacy: boolean;
  data: LegacyData;
  error: string | null;
};

export async function getUserLegacyContext(): Promise<UserLegacyContextResult> {
  const emptyData: LegacyData = {
    timeline: [],
    achievements: [],
    certificates: [],
    lifeEvents: [],
    milestones: [],
  };

  const { data, error } = await loadLegacyData();

  if (error === "Usuário não autenticado.") {
    return { context: null, hasLegacy: false, data: emptyData, error };
  }

  if (isLegacyEmpty(data)) {
    return { context: null, hasLegacy: false, data, error: null };
  }

  const ctx = await getOptionalDataContext();
  const displayName = ctx ? await resolveUserDisplayName(ctx) : undefined;
  const context = buildIdentityContextFromData(data, displayName);

  return {
    context,
    hasLegacy: true,
    data,
    error: error ?? null,
  };
}

const IDENTITY_MARKER = "AURA IDENTITY";

export async function appendUserIdentityContext(
  baseContext: string | null
): Promise<string | null> {
  if (baseContext?.includes(IDENTITY_MARKER)) return baseContext;

  const { context: identityContext } = await getUserLegacyContext();
  if (!identityContext) return baseContext;

  if (!baseContext?.trim()) return identityContext;
  return `${baseContext}\n\n${identityContext}`;
}
