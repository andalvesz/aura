import {
  getMetaConnectDashboard,
  runMetaCampaignAction,
} from "@/lib/supabase/services/meta-connect.service";
import type { MetaCampaignAction } from "@/utils/integrations";

export async function GET() {
  const result = await getMetaConnectDashboard();
  if (result.error) {
    return Response.json({ error: result.error }, {
      status: result.error === "Usuário não autenticado." ? 401 : 500,
    });
  }
  return Response.json(result.data);
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    campaignId?: string;
    action?: MetaCampaignAction;
    approved?: boolean;
  };

  if (!body.campaignId || !body.action) {
    return Response.json({ error: "campaignId e action são obrigatórios." }, { status: 400 });
  }

  const result = await runMetaCampaignAction({
    campaignId: body.campaignId,
    action: body.action,
    approved: body.approved === true,
  });

  if (result.error) {
    return Response.json(
      { error: result.error, requiresApproval: "requiresApproval" in result ? result.requiresApproval : false },
      { status: 422 }
    );
  }

  return Response.json({ ok: true, result });
}
