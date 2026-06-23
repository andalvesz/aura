import {
  getExpertInfluenceDashboard,
  getLatestExpertInfluence,
} from "@/lib/supabase/services/expert-influence.service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const module = url.searchParams.get("module")?.trim();

  if (module) {
    const { audit, appliedKnowledge } = await getLatestExpertInfluence(module);
    return Response.json({ audit, appliedKnowledge });
  }

  const { dashboard, error } = await getExpertInfluenceDashboard();
  if (error) {
    return Response.json({ error }, { status: 400 });
  }
  return Response.json({ dashboard });
}
