import { notFound } from "next/navigation";
import { PriorityViewClient } from "@/components/dashboard/priorities/priority-view-client";
import {
  explainPriorityItem,
  getPriorityItem,
} from "@/lib/supabase/services/prioritization.service";

export default async function PriorityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let item = null;
  let explanation = null;
  try {
    item = await getPriorityItem(id);
    if (item) explanation = await explainPriorityItem(id);
  } catch {
    item = null;
  }
  if (!item) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl py-2">
      <PriorityViewClient item={item} explanation={explanation} />
    </div>
  );
}
