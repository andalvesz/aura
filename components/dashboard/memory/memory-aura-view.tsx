import Link from "next/link";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { MemoryManualEntry } from "@/components/dashboard/memory/memory-manual-entry";
import { MemoryRecordActions } from "@/components/dashboard/memory/memory-record-actions";
import type { MemoryRecord } from "@/lib/memory/types";
import {
  bootstrapMemoryFromConfirmedData,
  getMemoryTimeline,
  listMemories,
} from "@/lib/supabase/services/memory-engine.service";

function MemoryRow({ memory }: { memory: MemoryRecord }) {
  return (
    <li
      className="rounded-md border border-white/[0.06] bg-zinc-950/50 p-3"
      data-testid="memory-record-row"
      data-memory-type={memory.memoryType}
      data-memory-status={memory.status}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] text-zinc-100">{memory.title}</p>
          <p className="text-[11px] text-zinc-500">{memory.content}</p>
          <p className="mt-1 text-[11px] text-zinc-600">
            {memory.memoryType} · {memory.context} · origem {memory.sourceType}
          </p>
        </div>
        <div className="text-right text-[10px] text-zinc-500">
          <p>
            {memory.status} · conf {memory.confidence}% · imp {memory.importance}
          </p>
          <p>retenção: {memory.retentionPolicy}</p>
          <p>promoção: {memory.promotionStatus}</p>
          <p>{memory.occurredAt.slice(0, 10)}</p>
        </div>
      </div>
      <MemoryRecordActions memory={memory} />
    </li>
  );
}

function MemoryList({
  memories,
  empty,
}: {
  memories: MemoryRecord[];
  empty: string;
}) {
  if (!memories.length) {
    return <p className="text-[12px] text-zinc-600">{empty}</p>;
  }
  return (
    <ul className="space-y-2">
      {memories.map((m) => (
        <MemoryRow key={m.id} memory={m} />
      ))}
    </ul>
  );
}

export async function MemoryAuraView() {
  await bootstrapMemoryFromConfirmedData({ maxItems: 20 });

  const [all, timeline] = await Promise.all([
    listMemories({
      includeArchived: true,
      includeDeleted: false,
      limit: 100,
    }),
    getMemoryTimeline({ limit: 30 }),
  ]);

  const recent = all
    .filter((m) => m.status !== "ARCHIVED" && m.status !== "DELETED")
    .slice(0, 12);
  const semantic = all.filter(
    (m) => m.memoryType === "SEMANTIC" && m.status !== "ARCHIVED"
  );
  const episodic = all.filter(
    (m) => m.memoryType === "EPISODIC" && m.status !== "ARCHIVED"
  );
  const procedural = all.filter(
    (m) => m.memoryType === "PROCEDURAL" && m.status !== "ARCHIVED"
  );
  const reflective = all.filter(
    (m) =>
      m.memoryType === "REFLECTIVE" &&
      (m.status === "PENDING_REVIEW" || m.status === "ACTIVE")
  );
  const pendingConfirm = all.filter(
    (m) => m.status === "PENDING_REVIEW" || m.promotionStatus === "QUEUED_FOR_REVIEW"
  );
  const disputed = all.filter(
    (m) =>
      m.status === "DISPUTED" ||
      m.status === "CORRECTED" ||
      m.status === "REJECTED"
  );
  const archived = all.filter((m) => m.status === "ARCHIVED");

  return (
    <div className="space-y-6" data-testid="memory-aura-view">
      <header className="space-y-1">
        <p className="text-[11px] uppercase tracking-wide text-zinc-500">
          Aura Brain
        </p>
        <h1 className="text-lg font-semibold text-zinc-100">Memórias do Aura</h1>
        <p className="text-[13px] text-zinc-500">
          O que o Aura lembra — com origem, confiança e controle seu. Lembrar não
          significa transformar em identidade.
        </p>
        <div className="flex flex-wrap gap-3 pt-1 text-[12px]">
          <Link
            href="/dashboard/settings/aura-brain"
            className="text-zinc-500 hover:text-zinc-300"
          >
            ← Aura Brain
          </Link>
          <Link
            href="/dashboard/settings/identity"
            className="text-amber-400/90 hover:text-amber-300"
          >
            Como o Aura me entende →
          </Link>
        </div>
      </header>

      <DashboardCard title="Registrar memória" status="ok">
        <MemoryManualEntry />
      </DashboardCard>

      <DashboardCard title="Memórias recentes" status="ok">
        <MemoryList
          memories={recent}
          empty="Nenhuma memória ainda. Registre uma memória para o Aura começar a identificar conexões."
        />
      </DashboardCard>

      <DashboardCard title="Fatos e conhecimentos" status="ok">
        <MemoryList memories={semantic} empty="Nenhum fato semântico." />
      </DashboardCard>

      <DashboardCard title="Experiências" status="ok">
        <MemoryList memories={episodic} empty="Nenhuma experiência episódica." />
      </DashboardCard>

      <DashboardCard title="Processos aprendidos" status="ok">
        <MemoryList
          memories={procedural}
          empty="Nenhum procedimento registrado."
        />
      </DashboardCard>

      <DashboardCard title="Padrões em revisão" status="ok">
        <MemoryList
          memories={reflective}
          empty="Nenhum padrão reflexivo em revisão."
        />
      </DashboardCard>

      <DashboardCard title="Aguardando confirmação" status="ok">
        <MemoryList
          memories={pendingConfirm}
          empty="Nada aguardando confirmação."
        />
      </DashboardCard>

      <DashboardCard title="Corrigidas ou contestadas" status="ok">
        <MemoryList memories={disputed} empty="Nenhuma correção ou disputa." />
      </DashboardCard>

      <DashboardCard title="Arquivadas" status="ok">
        <MemoryList memories={archived} empty="Nenhuma memória arquivada." />
      </DashboardCard>

      <DashboardCard title="Linha do tempo" status="ok">
        {timeline.length === 0 ? (
          <p className="text-[12px] text-zinc-600">Timeline vazia.</p>
        ) : (
          <ol className="space-y-2" data-testid="memory-timeline">
            {timeline.map((entry) => (
              <li
                key={entry.memory.id}
                className="border-l border-white/10 pl-3 text-[12px]"
              >
                <p className="text-zinc-300">{entry.memory.title}</p>
                <p className="text-[11px] text-zinc-600">
                  {entry.memory.occurredAt.slice(0, 10)} ·{" "}
                  {entry.memory.memoryType} · {entry.memory.status}
                </p>
                <p className="text-[11px] text-zinc-500">
                  {entry.explanation.split("\n")[0]}
                </p>
              </li>
            ))}
          </ol>
        )}
      </DashboardCard>
    </div>
  );
}
