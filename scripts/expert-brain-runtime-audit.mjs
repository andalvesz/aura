/**
 * Expert Brain Runtime Audit — Sprint 1 (queue stabilization).
 * Uso: npm run expert-brain-runtime-audit
 *
 * Verifica (contra o Supabase real, escopo do usuário de auditoria):
 *  - conexão Google Drive
 *  - contagem por estado
 *  - leases expirados
 *  - itens sem progresso há mais de 30 min
 *  - itens duplicados pelo mesmo drive_file_id
 *  - inconsistência entre status e progress
 *  - métricas mutuamente exclusivas (pending/processing nunca se sobrepõem)
 *  - migrations necessárias (colunas de lease/progresso)
 *
 * Não escreve nada no banco — apenas lê e relata.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  bucketForItem,
  countBuckets,
  deriveQueueMetrics,
  isLeaseValid,
} from "../utils/expert-brain-state-machine.ts";

function loadEnvLocal() {
  try {
    const path = resolve(process.cwd(), ".env.local");
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local optional
  }
}

const REQUIRED_COLUMNS = [
  "status",
  "progress",
  "current_step",
  "current_chunk",
  "total_chunks",
  "processed_chunks",
  "retry_count",
  "last_error",
  "last_attempt_at",
  "next_retry_at",
  "processing_started_at",
  "lease_until",
  "processing_by",
  "updated_at",
];

function driveFileIdOf(item) {
  const meta = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
  return meta.drive_file_id ?? meta.driveFileId ?? null;
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const report = {
  timestamp: new Date().toISOString(),
  ok: true,
  findings: [],
  driveConnection: null,
  stateCounts: {},
  buckets: null,
  queueMetrics: null,
  expiredLeases: [],
  stalledItems: [],
  duplicateDriveFiles: [],
  statusProgressInconsistencies: [],
  mutualExclusivity: null,
  migrationsNeeded: [],
};

function finding(level, message) {
  report.findings.push({ level, message });
  if (level === "error") report.ok = false;
}

if (!url || !anon) {
  finding("error", "Faltam NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

const supabase = createClient(url, anon);

async function ensureAuth() {
  const email = process.env.AURA_AUDIT_EMAIL;
  const password = process.env.AURA_AUDIT_PASSWORD;
  if (!email || !password) {
    finding(
      "warning",
      "AURA_AUDIT_EMAIL / AURA_AUDIT_PASSWORD ausentes — auditoria de dados por usuário será pulada (apenas checagem de schema)."
    );
    return null;
  }
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (!signIn.error && signIn.data.session) return signIn.data.session;
  finding("warning", `Auth falhou: ${signIn.error?.message ?? "sem sessão"}`);
  return null;
}

try {
  // --- Schema / migrations check (does not require a row) ---
  const probe = await supabase.from("expert_ingestion_queue").select("*").limit(1);
  if (probe.error) {
    const msg = probe.error.message.toLowerCase();
    if (msg.includes("does not exist") || probe.error.code === "42P01") {
      finding("error", "Tabela expert_ingestion_queue ausente.");
      report.migrationsNeeded.push("20260621120000_expert_brain_storage_ingestion.sql");
    } else {
      finding("warning", `Probe expert_ingestion_queue: ${probe.error.message}`);
    }
  } else {
    const sample = probe.data?.[0];
    if (sample) {
      for (const col of REQUIRED_COLUMNS) {
        if (!(col in sample)) {
          report.migrationsNeeded.push(col);
        }
      }
      if (report.migrationsNeeded.length) {
        finding(
          "error",
          `Colunas ausentes (${report.migrationsNeeded.join(", ")}). Rode 20260717120000_expert_brain_queue_lease.sql`
        );
      }
    } else {
      finding("info", "Tabela existe mas está vazia — checagem de colunas por linha pulada.");
    }
  }

  const session = await ensureAuth();

  if (session) {
    const userId = session.user.id;
    report.auth = { user_id: userId, email: session.user.email };

    // --- Drive connection ---
    const conn = await supabase
      .from("google_drive_connections")
      .select("status,last_error,google_email,expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    report.driveConnection = conn.data ?? null;
    const driveExpired = conn.data?.status === "expired";

    // --- Load queue rows ---
    const { data: rows, error: rowsError } = await supabase
      .from("expert_ingestion_queue")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1000);

    if (rowsError) {
      finding("error", `Falha ao ler fila: ${rowsError.message}`);
    } else {
      const items = rows ?? [];
      const now = new Date();

      // state counts
      for (const item of items) {
        report.stateCounts[item.status] = (report.stateCounts[item.status] ?? 0) + 1;
      }

      // buckets + queue metrics (mutually exclusive)
      const buckets = countBuckets(items, { driveConnectionExpired: driveExpired, now });
      report.buckets = buckets;
      report.queueMetrics = deriveQueueMetrics(buckets);

      // mutual exclusivity check: each item in exactly one bucket
      const bucketSum = Object.values(buckets).reduce((a, b) => a + b, 0);
      report.mutualExclusivity = {
        totalItems: items.length,
        bucketSum,
        exclusive: bucketSum === items.length,
      };
      if (bucketSum !== items.length) {
        finding("error", `Buckets não mutuamente exclusivos: soma=${bucketSum} itens=${items.length}`);
      }

      // expired leases
      report.expiredLeases = items
        .filter((i) => i.lease_until && !isLeaseValid(i.lease_until, now))
        .map((i) => ({ id: i.id, status: i.status, lease_until: i.lease_until }));
      if (report.expiredLeases.length) {
        finding("warning", `${report.expiredLeases.length} lease(s) expirado(s) — serão recuperados no próximo tick.`);
      }

      // stalled (>30 min without progress and not terminal)
      const THIRTY_MIN = 30 * 60_000;
      report.stalledItems = items
        .filter((i) => {
          if (["completed", "failed", "done"].includes(i.status)) return false;
          const ref = Date.parse(i.updated_at ?? i.last_attempt_at ?? i.created_at);
          if (Number.isNaN(ref)) return false;
          // ignore items intentionally backing off
          if (i.next_retry_at && Date.parse(i.next_retry_at) > now.getTime()) return false;
          return now.getTime() - ref > THIRTY_MIN;
        })
        .map((i) => ({ id: i.id, status: i.status, updated_at: i.updated_at }));
      if (report.stalledItems.length) {
        finding("warning", `${report.stalledItems.length} item(ns) sem progresso há mais de 30 min.`);
      }

      // duplicate drive_file_id
      const byDrive = new Map();
      for (const item of items) {
        const id = driveFileIdOf(item);
        if (!id) continue;
        byDrive.set(id, [...(byDrive.get(id) ?? []), item.id]);
      }
      report.duplicateDriveFiles = [...byDrive.entries()]
        .filter(([, ids]) => ids.length > 1)
        .map(([driveFileId, ids]) => ({ driveFileId, ids }));
      if (report.duplicateDriveFiles.length) {
        finding("warning", `${report.duplicateDriveFiles.length} drive_file_id duplicado(s).`);
      }

      // status/progress inconsistencies
      report.statusProgressInconsistencies = items
        .filter((i) => {
          if (i.status === "completed" && (i.progress ?? 0) < 100) return true;
          if (i.status === "failed") return false;
          if (i.status === "pending_drive" && (i.progress ?? 0) >= 100) return true;
          return false;
        })
        .map((i) => ({ id: i.id, status: i.status, progress: i.progress }));
      if (report.statusProgressInconsistencies.length) {
        finding("warning", `${report.statusProgressInconsistencies.length} inconsistência(s) status/progress.`);
      }

      // sanity: bucket sample for one item
      if (items[0]) {
        report.sampleBucket = bucketForItem(items[0], {
          driveConnectionExpired: driveExpired,
          now,
        });
      }
    }
  }
} catch (err) {
  finding("error", err instanceof Error ? err.message : String(err));
  report.stack = err instanceof Error ? err.stack : null;
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
