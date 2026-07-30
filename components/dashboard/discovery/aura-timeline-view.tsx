import Link from "next/link";
import type { TimelineEvent } from "@/lib/discovery/types";

const KIND_LABEL: Record<TimelineEvent["kind"], string> = {
  memory: "Memory",
  promotion: "Promotion",
  world: "World",
  insight: "Insight",
  discovery: "Discovery",
};

const KIND_COLOR: Record<TimelineEvent["kind"], string> = {
  memory: "text-violet-400",
  promotion: "text-amber-400",
  world: "text-emerald-400",
  insight: "text-cyan-400",
  discovery: "text-rose-300",
};

export function AuraTimelineView({ events }: { events: TimelineEvent[] }) {
  if (!events.length) {
    return (
      <p className="text-[12px] text-zinc-500" data-testid="aura-timeline-empty">
        Timeline vazia — registre memórias e rode Discovery.
      </p>
    );
  }

  return (
    <ol className="space-y-2" data-testid="aura-timeline">
      {events.map((ev) => (
        <li
          key={ev.id}
          className="flex gap-3 border-l border-white/[0.06] pl-3"
          data-timeline-kind={ev.kind}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span
                className={`text-[10px] uppercase tracking-wide ${KIND_COLOR[ev.kind]}`}
              >
                {KIND_LABEL[ev.kind]}
              </span>
              <span className="text-[10px] text-zinc-600">
                {ev.occurredAt.slice(0, 16).replace("T", " ")}
              </span>
            </div>
            <Link
              href={ev.href}
              className="text-[12px] text-zinc-200 hover:text-white"
            >
              {ev.title}
            </Link>
            {ev.summary ? (
              <p className="text-[11px] text-zinc-500">{ev.summary}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
