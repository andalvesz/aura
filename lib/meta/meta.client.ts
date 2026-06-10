const META_GRAPH = "https://graph.facebook.com/v21.0";

type MetaGraphError = {
  error?: { message?: string; type?: string; code?: number };
};

async function metaFetch<T>(
  path: string,
  accessToken: string,
  options?: { method?: string; body?: Record<string, string> }
): Promise<T> {
  const url = new URL(`${META_GRAPH}${path}`);
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), {
    method: options?.method ?? "GET",
    headers: options?.body ? { "Content-Type": "application/x-www-form-urlencoded" } : undefined,
    body: options?.body ? new URLSearchParams(options.body).toString() : undefined,
  });

  const data = (await res.json()) as T & MetaGraphError;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Erro Meta API (${res.status}).`);
  }
  return data;
}

export async function testMetaConnection(accessToken: string) {
  const me = await metaFetch<{ id: string; name?: string }>("/me?fields=id,name", accessToken);
  return { ok: true, label: me.name ?? me.id };
}

export async function listMetaAdAccounts(accessToken: string) {
  const data = await metaFetch<{
    data?: Array<{
      id: string;
      name?: string;
      account_status?: number;
      currency?: string;
      timezone_name?: string;
    }>;
  }>("/me/adaccounts?fields=id,name,account_status,currency,timezone_name&limit=50", accessToken);

  return (data.data ?? []).map((account) => ({
    externalAccountId: account.id.replace("act_", ""),
    name: account.name ?? account.id,
    currency: account.currency ?? "USD",
    timezone: account.timezone_name ?? null,
    status: account.account_status === 1 ? "active" : "inactive",
  }));
}

export async function listMetaCampaigns(
  accessToken: string,
  adAccountExternalId: string
) {
  const actId = adAccountExternalId.startsWith("act_")
    ? adAccountExternalId
    : `act_${adAccountExternalId}`;

  const data = await metaFetch<{
    data?: Array<{
      id: string;
      name?: string;
      status?: string;
      effective_status?: string;
      objective?: string;
      daily_budget?: string;
    }>;
  }>(
    `/${actId}/campaigns?fields=id,name,status,effective_status,objective,daily_budget&limit=100`,
    accessToken
  );

  return (data.data ?? []).map((campaign) => ({
    externalCampaignId: campaign.id,
    name: campaign.name ?? "Campanha",
    status: mapMetaStatus(campaign.status),
    effectiveStatus: campaign.effective_status ?? campaign.status ?? "UNKNOWN",
    objective: campaign.objective ?? null,
    dailyBudgetCents: campaign.daily_budget
      ? Math.round(Number(campaign.daily_budget))
      : null,
  }));
}

export async function updateMetaCampaignStatus(
  accessToken: string,
  externalCampaignId: string,
  status: "ACTIVE" | "PAUSED"
) {
  return metaFetch<{ success?: boolean }>(
    `/${externalCampaignId}`,
    accessToken,
    {
      method: "POST",
      body: { status },
    }
  );
}

export async function duplicateMetaCampaign(
  accessToken: string,
  externalCampaignId: string
) {
  return metaFetch<{ copied_campaign_id?: string }>(
    `/${externalCampaignId}/copies`,
    accessToken,
    {
      method: "POST",
      body: {
        status_option: "PAUSED",
        deep_copy: "false",
      },
    }
  );
}

export async function fetchMetaCampaignInsights(
  accessToken: string,
  externalCampaignId: string
) {
  const data = await metaFetch<{
    data?: Array<{
      impressions?: string;
      clicks?: string;
      spend?: string;
      ctr?: string;
      cpc?: string;
      actions?: Array<{ action_type: string; value: string }>;
    }>;
  }>(
    `/${externalCampaignId}/insights?fields=impressions,clicks,spend,ctr,cpc,actions&date_preset=last_7d`,
    accessToken
  );

  const row = data.data?.[0];
  if (!row) {
    return {
      impressions: 0,
      clicks: 0,
      spendCents: 0,
      ctr: 0,
      cpa: 0,
      roas: 0,
      conversions: 0,
    };
  }

  const impressions = Number(row.impressions ?? 0);
  const clicks = Number(row.clicks ?? 0);
  const spend = Number(row.spend ?? 0);
  const ctr = Number(row.ctr ?? 0);
  const conversions =
    row.actions?.find((a) => a.action_type === "purchase")?.value ?? 0;
  const convCount = Number(conversions);
  const cpa = convCount > 0 ? spend / convCount : 0;
  const roas = spend > 0 ? (convCount * 100) / spend : 0;

  return {
    impressions,
    clicks,
    spendCents: Math.round(spend * 100),
    ctr: Math.round(ctr * 100) / 100,
    cpa: Math.round(cpa * 100) / 100,
    roas: Math.round(roas * 100) / 100,
    conversions: convCount,
  };
}

function mapMetaStatus(status?: string): "active" | "paused" | "archived" | "draft" {
  if (status === "ACTIVE") return "active";
  if (status === "PAUSED") return "paused";
  if (status === "ARCHIVED") return "archived";
  return "draft";
}
