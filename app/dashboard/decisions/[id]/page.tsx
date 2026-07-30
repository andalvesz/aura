import { notFound } from "next/navigation";
import { DecisionViewClient } from "@/components/dashboard/decisions/decision-view-client";
import {
  explainDecisionCard,
  getDecisionCard,
} from "@/lib/supabase/services/decision-support.service";

export default async function DecisionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let card = null;
  let explanation = null;
  try {
    card = await getDecisionCard(id);
    if (card) explanation = await explainDecisionCard(id);
  } catch {
    card = null;
  }
  if (!card) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl py-2">
      <DecisionViewClient card={card} explanation={explanation} />
    </div>
  );
}
