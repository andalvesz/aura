/**
 * Discovery privacy guards — ADR-007
 */

import type {
  DiscoveryArtifact,
  DiscoverySensitivity,
} from "@/lib/discovery/types";

const SENSITIVE_PATTERNS =
  /\b(cpf|rg\b|senha|password|ssn|cart[aã]o|credit.?card|pix\s*key)\b/i;

export function assertDiscoveryPrivacy(artifact: DiscoveryArtifact): void {
  if (artifact.sensitivity === "RESTRICTED") {
    throw new Error("RESTRICTED discovery must not leave privacy boundary");
  }
}

export function inferSensitivity(text: string): DiscoverySensitivity {
  if (SENSITIVE_PATTERNS.test(text)) return "SENSITIVE";
  return "STANDARD";
}

export function sanitizeDiscoveryText(text: string): string {
  return text.replace(SENSITIVE_PATTERNS, "[redacted]").slice(0, 2000);
}
