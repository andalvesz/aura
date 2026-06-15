import {
  autoSyncKiwifyIfDue,
  getKiwifyIntelligence,
} from "@/lib/supabase/services/kiwify-intelligence.service";

export async function GET() {
  await autoSyncKiwifyIfDue();
  const result = await getKiwifyIntelligence();
  if (result.error) {
    return Response.json({ error: result.error }, {
      status: result.error === "Usuário não autenticado." ? 401 : 500,
    });
  }

  const data = result.data!;
  const topAffiliateProducts = data.products
    .filter((p) => p.affiliate_enabled)
    .slice(0, 5);

  return Response.json({
    connection: data.connection,
    products: data.products,
    sales: data.sales,
    commissions: data.commissions,
    revenueTotalCents: data.metrics.revenueTotalCents,
    commissionsTotalCents: data.metrics.commissionsCents,
    topAffiliateProducts,
    metrics: data.metrics,
    insights: data.insights,
    connected: data.connected,
  });
}
