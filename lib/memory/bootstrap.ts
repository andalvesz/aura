/**
 * Safe optional bootstrap from confirmed existing data.
 * Idempotent. Never promotes. Never imports isolated searches as interests.
 */

import {
  createMemoryPure,
  type MemoryEngineState,
} from "@/lib/memory/engine";
import type { CreateMemoryInput } from "@/lib/memory/types";

export type MemoryBootstrapInput = {
  userId: string;
  fullName?: string | null;
  preferredLanguage?: string | null;
  confirmedIdentityClaims?: Array<{
    key: string;
    label: string;
    value: unknown;
    category: string;
  }>;
  explicitMissionSummaries?: Array<{
    id: string;
    title: string;
    type: string;
    createdAt?: string;
  }>;
  completedEventTitles?: Array<{
    id: string;
    title: string;
    occurredAt?: string;
  }>;
  registeredBusinessNames?: Array<{
    id: string;
    name: string;
  }>;
  dryRun?: boolean;
  maxItems?: number;
};

export type MemoryBootstrapReport = {
  dryRun: boolean;
  proposed: number;
  applied: number;
  skipped: number;
  items: Array<{ title: string; reason: string; applied: boolean }>;
};

export function buildBootstrapMemoryInputs(
  input: MemoryBootstrapInput
): CreateMemoryInput[] {
  const out: CreateMemoryInput[] = [];
  const max = input.maxItems ?? 40;

  if (input.fullName?.trim()) {
    out.push({
      memoryType: "SEMANTIC",
      title: "Nome preferido (bootstrap)",
      content: `Nome cadastrado: ${input.fullName.trim()}`,
      structuredContent: {
        kind: "semantic",
        factKey: "preferred_name",
        factValue: input.fullName.trim(),
        summary: input.fullName.trim(),
      },
      sourceType: "bootstrap_confirmed",
      sourceReference: { entityType: "profile", entityId: input.userId },
      context: "personal",
      semanticKey: "preferred_name",
      confirmNow: true,
      retentionPolicy: "user_managed",
      idempotencyKey: `bootstrap:preferred_name:${input.userId}`,
      evidenceSummary: "Cadastro confirmado",
    });
  }

  if (input.preferredLanguage?.trim()) {
    out.push({
      memoryType: "SEMANTIC",
      title: "Idioma configurado (bootstrap)",
      content: `Idioma: ${input.preferredLanguage.trim()}`,
      structuredContent: {
        kind: "semantic",
        factKey: "preferred_language",
        factValue: input.preferredLanguage.trim(),
        summary: input.preferredLanguage.trim(),
      },
      sourceType: "bootstrap_confirmed",
      context: "personal",
      semanticKey: "preferred_language",
      confirmNow: true,
      retentionPolicy: "user_managed",
      idempotencyKey: `bootstrap:preferred_language:${input.userId}`,
      evidenceSummary: "Configuração explícita",
    });
  }

  for (const claim of input.confirmedIdentityClaims ?? []) {
    out.push({
      memoryType: "SEMANTIC",
      title: `Claim confirmada: ${claim.label}`,
      content: String(claim.value),
      structuredContent: {
        kind: "semantic",
        factKey: claim.key,
        factValue: claim.value,
        contextScope: claim.category,
        summary: claim.label,
      },
      sourceType: "identity_engine",
      sourceReference: {
        entityType: "identity_claim",
        entityId: claim.key,
      },
      context: claim.category,
      semanticKey: claim.key,
      confirmNow: true,
      retentionPolicy: "user_managed",
      idempotencyKey: `bootstrap:identity:${input.userId}:${claim.key}`,
      evidenceSummary: "Identity claim confirmada",
    });
  }

  for (const mission of input.explicitMissionSummaries ?? []) {
    out.push({
      memoryType: "EPISODIC",
      title: `Missão criada: ${mission.title}`,
      content: `Missão ${mission.type} criada pelo usuário`,
      structuredContent: {
        kind: "episodic",
        when: mission.createdAt ?? new Date().toISOString(),
        summary: mission.title,
        participants: [
          { subjectType: "mission", subjectId: mission.id, label: mission.title },
        ],
      },
      sourceType: "mission_engine",
      sourceReference: { entityType: "mission", entityId: mission.id },
      context: "missions",
      subjects: [
        { subjectType: "mission", subjectId: mission.id, label: mission.title },
      ],
      occurredAt: mission.createdAt,
      idempotencyKey: `bootstrap:mission:${mission.id}`,
      evidenceSummary: "Missão criada explicitamente",
      confirmNow: true,
    });
  }

  for (const ev of input.completedEventTitles ?? []) {
    out.push({
      memoryType: "EPISODIC",
      title: `Evento concluído: ${ev.title}`,
      content: ev.title,
      structuredContent: {
        kind: "episodic",
        when: ev.occurredAt ?? new Date().toISOString(),
        summary: ev.title,
      },
      sourceType: "calendar",
      sourceReference: { entityType: "event", entityId: ev.id },
      context: "calendar",
      occurredAt: ev.occurredAt,
      idempotencyKey: `bootstrap:event:${ev.id}`,
      evidenceSummary: "Evento concluído com ownership",
      confirmNow: true,
    });
  }

  for (const biz of input.registeredBusinessNames ?? []) {
    out.push({
      memoryType: "SEMANTIC",
      title: `Empresa cadastrada: ${biz.name}`,
      content: biz.name,
      structuredContent: {
        kind: "semantic",
        factKey: `business_name:${biz.id}`,
        factValue: biz.name,
        summary: biz.name,
      },
      sourceType: "business",
      sourceReference: { entityType: "business", entityId: biz.id },
      context: "business",
      semanticKey: `business_name:${biz.id}`,
      confirmNow: true,
      retentionPolicy: "long_term",
      idempotencyKey: `bootstrap:business:${biz.id}`,
      evidenceSummary: "Empresa cadastrada pelo usuário",
    });
  }

  return out.slice(0, max);
}

export function applyBootstrapToMemoryState(
  state: MemoryEngineState,
  userId: string,
  input: MemoryBootstrapInput
): { state: MemoryEngineState; report: MemoryBootstrapReport } {
  const proposed = buildBootstrapMemoryInputs({ ...input, userId });
  const report: MemoryBootstrapReport = {
    dryRun: Boolean(input.dryRun),
    proposed: proposed.length,
    applied: 0,
    skipped: 0,
    items: [],
  };

  if (input.dryRun) {
    for (const p of proposed) {
      report.items.push({
        title: p.title,
        reason: "dry-run",
        applied: false,
      });
      report.skipped++;
    }
    return { state, report };
  }

  let next = state;
  for (const p of proposed) {
    const existing = next.memories.find(
      (m) => m.userId === userId && m.idempotencyKey === p.idempotencyKey
    );
    if (existing) {
      report.skipped++;
      report.items.push({
        title: p.title,
        reason: "já existia (idempotente)",
        applied: false,
      });
      continue;
    }
    const res = createMemoryPure(next, userId, p);
    if (res.ok && res.data) {
      next = res.state;
      report.applied++;
      report.items.push({ title: p.title, reason: "importado", applied: true });
    } else {
      report.skipped++;
      report.items.push({
        title: p.title,
        reason: res.error ?? "falha",
        applied: false,
      });
    }
  }

  return { state: next, report };
}
