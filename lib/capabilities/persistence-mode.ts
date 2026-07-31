/**
 * Persistence mode — memory for unit tests; supabase for production.
 */

export type PlatformPersistenceMode = "memory" | "supabase";

export function resolvePlatformPersistenceMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): PlatformPersistenceMode {
  const forced = (env.AURA_PLATFORM_PERSISTENCE ?? "").toLowerCase();
  if (forced === "memory") return "memory";
  if (forced === "supabase") return "supabase";
  if (env.NODE_ENV === "test") return "memory";
  if (env.VITEST || env.NODE_TEST_CONTEXT) return "memory";
  return "supabase";
}

export function isMemoryPlatformPersistence(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>
): boolean {
  return resolvePlatformPersistenceMode(env) === "memory";
}
