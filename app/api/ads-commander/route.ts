import {
  approveCampaign,
  getAdsCommanderDashboard,
  prepareFullCampaign,
  publishCampaign,
  syncAdPlatformConnections,
} from "@/lib/supabase/services/ads-commander.service";
import type { AdPlatform } from "@/utils/ads-commander";

export async function GET() {
  const [{ dashboard, error }, { connections }] = await Promise.all([
    getAdsCommanderDashboard(),
    syncAdPlatformConnections(),
  ]);

  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({ dashboard, connections });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: string;
      operationId?: string;
      operation_id?: string;
      platform?: AdPlatform;
      campaignId?: string;
      explicitApproval?: boolean;
    };

    const operationId = body.operationId?.trim() || body.operation_id?.trim();

    switch (body.action) {
      case "prepare": {
        const { campaign, adSets, creatives, message, error } = await prepareFullCampaign({
          operationId,
          platform: body.platform ?? "meta",
        });
        if (error && !campaign) {
          return Response.json({ error, campaign, adSets, creatives }, { status: 400 });
        }
        return Response.json({ campaign, adSets, creatives, message, error });
      }
      case "approve": {
        if (!body.campaignId?.trim()) {
          return Response.json({ error: "Informe campaignId." }, { status: 400 });
        }
        const { campaign, message, error } = await approveCampaign(body.campaignId);
        if (error && !campaign) {
          return Response.json({ error }, { status: 422 });
        }
        return Response.json({ campaign, message, error });
      }
      case "publish": {
        if (!body.campaignId?.trim()) {
          return Response.json({ error: "Informe campaignId." }, { status: 400 });
        }
        const { campaign, message, error } = await publishCampaign(body.campaignId, {
          explicitApproval: body.explicitApproval === true,
        });
        if (error && !campaign) {
          return Response.json({ error }, { status: 422 });
        }
        return Response.json({ campaign, message, error });
      }
      default:
        return Response.json({ error: "Ação desconhecida." }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "Erro no Ads Commander." }, { status: 500 });
  }
}
