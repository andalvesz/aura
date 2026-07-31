import { notFound } from "next/navigation";
import { LearningDetailClient } from "@/components/dashboard/learning/learning-detail-client";
import { getLearningProposal } from "@/lib/supabase/services/learning.service";

export default async function LearningDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getLearningProposal(id);
  if (!data.proposal) notFound();
  return (
    <LearningDetailClient
      proposal={data.proposal}
      explanation={data.explanation}
      signals={data.signals}
      application={data.application}
      evaluation={data.evaluation}
    />
  );
}
