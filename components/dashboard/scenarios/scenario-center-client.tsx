"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  compareScenariosAction,
  searchScenariosAction,
  simulateScenariosAction,
  submitScenarioFeedbackAction,
} from "@/app/actions/scenario";
import {
  SCENARIO_STATUS_LABELS,
  SCENARIO_TYPE_LABELS,
  type ScenarioCard,
  type ScenarioComparison,
} from "@/lib/scenario/types/types";
import { FORM_INPUT_CLASS } from "@/utils/dashboard-mobile";
import { EmptyState } from "@/components/dashboard/empty-state";

export function ScenarioCenterClient({
  initial,
  initialComparisons,
}: {
  initial: ScenarioCard[];
  initialComparisons: ScenarioComparison[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cards, setCards] = useState(initial);
  const [comparisons, setComparisons] = useState(initialComparisons);
  const [query, setQuery] = useState("");
  const [whatIf, setWhatIf] = useState("E se iniciarmos este projeto?");
  const [selected, setSelected] = useState<string[]>([]);

  const visible = useMemo(
    () => cards.filter((c) => c.status !== "DISCARDED"),
    [cards]
  );

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="space-y-4" data-testid="scenario-center">
      <form
        className="space-y-2 rounded-lg border border-white/10 p-3"
        data-testid="what-if-form"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await simulateScenariosAction({
              whatIfPrompt: whatIf,
              whatIfOnly: false,
            });
            if (res.error) toast.error(res.error);
            else {
              toast.success(
                `${res.scenarios.length} cenários · validator rejeitou ${res.rejectedCount}`
              );
              router.refresh();
            }
          });
        }}
      >
        <p className="text-[12px] font-medium text-zinc-200">E se…</p>
        <p className="text-[11px] text-zinc-500">
          O Aura responde “o que pode acontecer se…” — nunca “faça isso”.
        </p>
        <input
          value={whatIf}
          onChange={(e) => setWhatIf(e.target.value)}
          required
          placeholder='Ex.: "E se adiarmos?" · "E se aumentarmos o investimento?"'
          className={FORM_INPUT_CLASS}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded bg-cyan-500/90 px-3 text-[13px] text-zinc-950"
          >
            Simular What-If
          </button>
          <button
            type="button"
            disabled={pending}
            className="min-h-11 rounded border border-white/10 px-3 text-[12px] text-zinc-300"
            onClick={() => {
              start(async () => {
                const res = await simulateScenariosAction({});
                if (res.error) toast.error(res.error);
                else {
                  toast.success(`${res.scenarios.length} cenários gerados`);
                  router.refresh();
                }
              });
            }}
          >
            Simular tipos (Best/Worst/…)
          </button>
          <p className="self-center text-[10px] text-zinc-600">
            executionInfluence: none
          </p>
        </div>
      </form>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            if (query.trim().length < 2) {
              setCards(initial);
              return;
            }
            setCards(await searchScenariosAction(query.trim()));
          });
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cenários, premissas, evidências…"
          className={FORM_INPUT_CLASS}
          data-testid="scenario-search"
        />
        <button
          type="submit"
          className="min-h-11 rounded border border-white/10 px-3 text-[12px] text-zinc-300"
        >
          Buscar
        </button>
      </form>

      {selected.length >= 2 ? (
        <button
          type="button"
          disabled={pending}
          className="min-h-11 w-full rounded border border-amber-500/40 px-3 text-[12px] text-amber-100"
          onClick={() => {
            start(async () => {
              const res = await compareScenariosAction({
                scenarioIds: selected,
              });
              if (res.error || !res.comparison) {
                toast.error(res.error ?? "Falha");
                return;
              }
              toast.success("Comparação criada");
              setComparisons((c) => [res.comparison!, ...c]);
              setSelected([]);
              router.refresh();
            });
          }}
        >
          Comparar {selected.length} cenários selecionados
        </button>
      ) : null}

      {!visible.length ? (
        <EmptyState
          title="Nenhum cenário"
          description='Use "E se…" para gerar ramos hipotéticos comparáveis.'
        />
      ) : (
        <ul className="space-y-2" data-testid="scenario-card-list">
          {visible.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-white/[0.06] bg-zinc-950/50 p-3"
              data-testid="scenario-card"
            >
              <div className="flex flex-wrap items-start gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={() => toggleSelect(c.id)}
                  className="mt-1"
                  aria-label={`Selecionar ${c.title}`}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/scenarios/${c.id}`}
                    className="text-[13px] text-zinc-100 hover:text-cyan-300"
                  >
                    {c.title}
                  </Link>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500">
                    {c.description}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-zinc-600">
                    <span>{SCENARIO_TYPE_LABELS[c.scenarioType]}</span>
                    <span>·</span>
                    <span>{SCENARIO_STATUS_LABELS[c.status]}</span>
                    <span>·</span>
                    <span>conf {c.confidence}</span>
                    <span>·</span>
                    <span>impacto {c.impact}</span>
                    <span>·</span>
                    <span className="text-emerald-600/80">exec: none</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-[11px]">
                  {(
                    [
                      ["save", "Salvar"],
                      ["archive", "Arquivar"],
                      ["discard", "Descartar"],
                    ] as const
                  ).map(([kind, label]) => (
                    <button
                      key={kind}
                      type="button"
                      className="text-left text-zinc-500 hover:text-cyan-300"
                      onClick={() => {
                        start(async () => {
                          const res = await submitScenarioFeedbackAction({
                            scenarioId: c.id,
                            kind,
                          });
                          if (res.error) toast.error(res.error);
                          else {
                            toast.success(label);
                            router.refresh();
                          }
                        });
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {comparisons.length ? (
        <section className="space-y-2" data-testid="scenario-comparisons">
          <h2 className="text-[12px] font-medium text-zinc-300">Comparações</h2>
          {comparisons.slice(0, 5).map((cmp) => (
            <div
              key={cmp.id}
              className="rounded-lg border border-white/[0.06] p-3 text-[12px]"
            >
              <p className="text-zinc-200">{cmp.title}</p>
              <p className="mt-1 text-zinc-500">{cmp.explanation}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-emerald-300/80">Vantagens</p>
                  <ul className="text-zinc-500">
                    {cmp.advantages.slice(0, 3).map((a) => (
                      <li key={a}>· {a}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-rose-300/80">Desvantagens</p>
                  <ul className="text-zinc-500">
                    {cmp.disadvantages.slice(0, 3).map((a) => (
                      <li key={a}>· {a}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-amber-300/80">Riscos</p>
                  <ul className="text-zinc-500">
                    {cmp.risks.slice(0, 3).map((a) => (
                      <li key={a}>· {a}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-cyan-300/80">Oportunidades</p>
                  <ul className="text-zinc-500">
                    {cmp.opportunities.slice(0, 3).map((a) => (
                      <li key={a}>· {a}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {cmp.missingData.length ? (
                <p className="mt-2 text-[11px] text-zinc-600">
                  Dados insuficientes: {cmp.missingData.join(", ")}
                </p>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
