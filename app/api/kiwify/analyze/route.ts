import { analyzeKiwifyAffiliateProducts } from "@/lib/supabase/services/kiwify-connect.service";

export async function POST() {
  const result = await analyzeKiwifyAffiliateProducts();
  if (result.error) {
    return Response.json({ error: result.error }, { status: 422 });
  }
  return Response.json({ analysis: result.analysis });
}
