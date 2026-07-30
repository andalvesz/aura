import { notFound } from "next/navigation";
import { ScenarioViewClient } from "@/components/dashboard/scenarios/scenario-view-client";
import {
  explainScenarioCard,
  getScenarioCard,
} from "@/lib/supabase/services/scenario.service";

export default async function ScenarioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let card = null;
  let explanation = null;
  try {
    card = await getScenarioCard(id);
    if (card) explanation = await explainScenarioCard(id);
  } catch {
    card = null;
  }
  if (!card) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl py-2">
      <ScenarioViewClient card={card} explanation={explanation} />
    </div>
  );
}
