/**
 * Quick Capture cascade — Memory → Promotion → World → Cognitive → Discovery.
 * Does not alter Cognitive Kernel internals; only calls public facades.
 * executionInfluence remains "none".
 */

import type { CascadeReport } from "@/lib/daily/types";

export type CascadeDeps = {
  promoteMemory: (memoryId: string) => Promise<{ error: string | null }>;
  projectMemoryToWorld: (
    memoryId: string
  ) => Promise<{ error: string | null }>;
  generateCognitive: () => Promise<{ error: string | null }>;
  generateDiscoveries: () => Promise<{
    error: string | null;
    generated: number;
  }>;
};

export async function runQuickCaptureCascade(
  memoryId: string,
  deps: CascadeDeps
): Promise<CascadeReport> {
  const started = Date.now();
  const errors: string[] = [];
  let promotionOk = false;
  let worldOk = false;
  let cognitiveOk = false;
  let discoveryOk = false;
  let discoveryGenerated = 0;

  try {
    const p = await deps.promoteMemory(memoryId);
    promotionOk = !p.error;
    if (p.error) errors.push(`promotion: ${p.error}`);
  } catch (e) {
    errors.push(`promotion: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const w = await deps.projectMemoryToWorld(memoryId);
    worldOk = !w.error;
    if (w.error) errors.push(`world: ${w.error}`);
  } catch (e) {
    errors.push(`world: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const c = await deps.generateCognitive();
    cognitiveOk = !c.error;
    if (c.error) errors.push(`cognitive: ${c.error}`);
  } catch (e) {
    errors.push(`cognitive: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const d = await deps.generateDiscoveries();
    discoveryOk = !d.error;
    discoveryGenerated = d.generated;
    if (d.error) errors.push(`discovery: ${d.error}`);
  } catch (e) {
    errors.push(`discovery: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    memoryId,
    promotionOk,
    worldOk,
    cognitiveOk,
    discoveryOk,
    discoveryGenerated,
    errors,
    durationMs: Date.now() - started,
    executionInfluence: "none",
  };
}
