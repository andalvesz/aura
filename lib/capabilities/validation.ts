/**
 * Config schema validation — no scripts, no forged versions.
 */

import type { DependencyIssue } from "@/lib/capabilities/types";

const FORBIDDEN_CONFIG_KEYS = [
  "__proto__",
  "constructor",
  "prototype",
  "script",
  "eval",
  "Function",
  "require",
  "child_process",
  "process",
];

export function validateConfigAgainstSchema(
  config: Record<string, unknown>,
  schema: Record<string, unknown>
): DependencyIssue[] {
  const issues: DependencyIssue[] = [];

  for (const key of Object.keys(config)) {
    if (FORBIDDEN_CONFIG_KEYS.includes(key)) {
      issues.push({
        code: "malicious_import",
        message: `Forbidden config key: ${key}`,
      });
    }
    const value = config[key];
    if (typeof value === "string" && /<script|javascript:|onerror=/i.test(value)) {
      issues.push({
        code: "malicious_import",
        message: `Suspicious script content in ${key}`,
      });
    }
    if (typeof value === "function") {
      issues.push({
        code: "invalid_config",
        message: `Functions not allowed in config (${key})`,
      });
    }
  }

  for (const [key, rule] of Object.entries(schema)) {
    if (!rule || typeof rule !== "object") continue;
    const r = rule as { type?: string; required?: boolean };
    if (r.required && !(key in config)) {
      issues.push({
        code: "invalid_config",
        message: `Missing required config: ${key}`,
      });
    }
    if (key in config && r.type) {
      const actual = typeof config[key];
      if (r.type === "number" && actual !== "number") {
        issues.push({
          code: "invalid_config",
          message: `Config ${key} must be number`,
        });
      }
      if (r.type === "string" && actual !== "string") {
        issues.push({
          code: "invalid_config",
          message: `Config ${key} must be string`,
        });
      }
      if (r.type === "boolean" && actual !== "boolean") {
        issues.push({
          code: "invalid_config",
          message: `Config ${key} must be boolean`,
        });
      }
    }
  }

  return issues;
}

export function validateDeclaredVersion(
  claimed: string,
  registered: string
): DependencyIssue[] {
  if (claimed !== registered) {
    return [
      {
        code: "version_forged",
        message: `Claimed version ${claimed} does not match registered ${registered}`,
      },
    ];
  }
  return [];
}

export function validateExportSchema(bundle: unknown): DependencyIssue[] {
  if (!bundle || typeof bundle !== "object") {
    return [{ code: "schema_invalid", message: "Bundle must be an object" }];
  }
  const b = bundle as Record<string, unknown>;
  if (b.formatVersion !== "aura-platform-config/v1") {
    return [
      {
        code: "schema_invalid",
        message: `Unsupported formatVersion: ${String(b.formatVersion)}`,
      },
    ];
  }
  if (!Array.isArray(b.capabilities) || !Array.isArray(b.skills)) {
    return [
      {
        code: "schema_invalid",
        message: "capabilities and skills must be arrays",
      },
    ];
  }
  const json = JSON.stringify(bundle);
  if (json.length > 500_000) {
    return [{ code: "malicious_import", message: "Payload too large" }];
  }
  if (/secret|token|password|apiKey|credential/i.test(json)) {
    return [
      {
        code: "malicious_import",
        message: "Export/import must not contain secrets",
      },
    ];
  }
  return [];
}
