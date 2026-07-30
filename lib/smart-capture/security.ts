/**
 * Virus scan structure (prepared) — no real scanner in RC3.1.
 */

import type { VirusScanResult } from "@/lib/smart-capture/types";

export function prepareVirusScan(): VirusScanResult {
  return {
    status: "skipped",
    provider: "prepared",
    scannedAt: null,
    detail: "Scanner estruturado; integração externa pendente",
  };
}

export function markVirusScanPending(): VirusScanResult {
  return {
    status: "pending",
    provider: "prepared",
    scannedAt: null,
    detail: "Aguardando provedor",
  };
}

export function markVirusScanClean(): VirusScanResult {
  return {
    status: "clean",
    provider: "prepared",
    scannedAt: new Date().toISOString(),
    detail: null,
  };
}
