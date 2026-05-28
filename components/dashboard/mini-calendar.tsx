"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/utils/cn";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "./panel";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function MiniCalendar() {
  const today = new Date();
  const [view, setView] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });

  const cells = useMemo(() => {
    const days = getDaysInMonth(view.year, view.month);
    const start = getFirstDayOfMonth(view.year, view.month);
    const items: (number | null)[] = [];

    for (let i = 0; i < start; i++) items.push(null);
    for (let d = 1; d <= days; d++) items.push(d);

    return items;
  }, [view.year, view.month]);

  const events = [3, 7, 12, 18, 22, 28];

  function prevMonth() {
    setView((v) =>
      v.month === 0
        ? { year: v.year - 1, month: 11 }
        : { year: v.year, month: v.month - 1 }
    );
  }

  function nextMonth() {
    setView((v) =>
      v.month === 11
        ? { year: v.year + 1, month: 0 }
        : { year: v.year, month: v.month + 1 }
    );
  }

  const isToday = (day: number) =>
    day === today.getDate() &&
    view.month === today.getMonth() &&
    view.year === today.getFullYear();

  return (
    <Panel className="h-full">
      <PanelHeader className="pb-2">
        <PanelTitle>{MONTHS[view.month]} {view.year}</PanelTitle>
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded p-1 text-zinc-500 transition-colors duration-200 hover:bg-white/[0.04] hover:text-zinc-300"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded p-1 text-zinc-500 transition-colors duration-200 hover:bg-white/[0.04] hover:text-zinc-300"
            aria-label="Próximo mês"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </PanelHeader>
      <PanelContent className="pt-0">
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {WEEKDAYS.map((d) => (
            <span
              key={d}
              className="py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600"
            >
              {d}
            </span>
          ))}
          {cells.map((day, i) => (
            <div key={i} className="flex aspect-square items-center justify-center">
              {day !== null && (
                <button
                  type="button"
                  className={cn(
                    "relative flex size-7 items-center justify-center rounded-md text-[11px] transition-colors duration-200",
                    isToday(day)
                      ? "bg-white text-zinc-950 font-medium"
                      : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300",
                    events.includes(day) &&
                      !isToday(day) &&
                      "after:absolute after:bottom-0.5 after:size-1 after:rounded-full after:bg-violet-400"
                  )}
                >
                  {day}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-1.5 border-t border-white/[0.06] pt-2">
          {[
            { time: "10:00", label: "Review de design" },
            { time: "14:30", label: "Sync com equipe" },
          ].map((e) => (
            <div
              key={e.label}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[11px] transition-colors duration-200 hover:bg-white/[0.03]"
            >
              <span className="font-mono text-zinc-600">{e.time}</span>
              <span className="truncate text-zinc-400">{e.label}</span>
            </div>
          ))}
        </div>
      </PanelContent>
    </Panel>
  );
}
