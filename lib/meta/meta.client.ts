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
      cpm?: string;
      frequency?: string;
      actions?: Array<{ action_type: string; value: string }>;
    }>;
  }>(
    `/${externalCampaignId}/insights?fields=impressions,clicks,spend,ctr,cpc,cpm,frequency,actions&date_preset=last_7d`,
    accessToken
  );

  const row = data.data?.[0];
  if (!row) {
    return {
      impressions: 0,
      clicks: 0,
      spendCents: 0,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      frequency: 0,
      cpa: 0,
      roas: 0,
      conversions: 0,
    };
  }

  const impressions = Number(row.impressions ?? 0);
  const clicks = Number(row.clicks ?? 0);
  const spend = Number(row.spend ?? 0);
  const ctr = Number(row.ctr ?? 0);
  const cpc = Number(row.cpc ?? 0);
  const cpm = Number(row.cpm ?? 0);
  const frequency = Number(row.frequency ?? 0);
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
    cpc: Math.round(cpc * 100) / 100,
    cpm: Math.round(cpm * 100) / 100,
    frequency: Math.round(frequency * 100) / 100,
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

function actId(adAccountExternalId: string): string {
  return adAccountExternalId.startsWith("act_")
    ? adAccountExternalId
    : `act_${adAccountExternalId}`;
}

export type MetaBusinessManager = {
  id: string;
  name: string;
};

export type MetaPage = {
  id: string;
  name: string;
  category: string | null;
};

export type MetaPixel = {
  id: string;
  name: string;
  adAccountId: string;
  lastFiredTime: string | null;
  isUnavailable: boolean;
};

export type MetaAdSet = {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  campaignId: string | null;
  dailyBudgetCents: number | null;
  adAccountId: string;
};

export type MetaAd = {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  adSetId: string | null;
  campaignId: string | null;
  adAccountId: string;
};

export type MetaAudience = {
  id: string;
  name: string;
  approximateCount: number;
  subtype: string | null;
  adAccountId: string;
};

export async function listMetaBusinessManagers(accessToken: string): Promise<MetaBusinessManager[]> {
  const data = await metaFetch<{
    data?: Array<{ id: string; name?: string }>;
  }>("/me/businesses?fields=id,name&limit=50", accessToken);

  return (data.data ?? []).map((business) => ({
    id: business.id,
    name: business.name ?? business.id,
  }));
}

export async function listMetaPages(accessToken: string): Promise<MetaPage[]> {
  const data = await metaFetch<{
    data?: Array<{ id: string; name?: string; category?: string }>;
  }>("/me/accounts?fields=id,name,category&limit=50", accessToken);

  return (data.data ?? []).map((page) => ({
    id: page.id,
    name: page.name ?? page.id,
    category: page.category ?? null,
  }));
}

export async function listMetaPixels(
  accessToken: string,
  adAccountExternalId: string
): Promise<MetaPixel[]> {
  const data = await metaFetch<{
    data?: Array<{
      id: string;
      name?: string;
      last_fired_time?: string;
      is_unavailable?: boolean;
    }>;
  }>(
    `/${actId(adAccountExternalId)}/adspixels?fields=id,name,last_fired_time,is_unavailable&limit=50`,
    accessToken
  );

  return (data.data ?? []).map((pixel) => ({
    id: pixel.id,
    name: pixel.name ?? pixel.id,
    adAccountId: adAccountExternalId,
    lastFiredTime: pixel.last_fired_time ?? null,
    isUnavailable: pixel.is_unavailable === true,
  }));
}

export async function listMetaAdSets(
  accessToken: string,
  adAccountExternalId: string
): Promise<MetaAdSet[]> {
  const data = await metaFetch<{
    data?: Array<{
      id: string;
      name?: string;
      status?: string;
      effective_status?: string;
      campaign_id?: string;
      daily_budget?: string;
    }>;
  }>(
    `/${actId(adAccountExternalId)}/adsets?fields=id,name,status,effective_status,campaign_id,daily_budget&limit=100`,
    accessToken
  );

  return (data.data ?? []).map((adSet) => ({
    id: adSet.id,
    name: adSet.name ?? "Conjunto",
    status: adSet.status ?? "UNKNOWN",
    effectiveStatus: adSet.effective_status ?? adSet.status ?? "UNKNOWN",
    campaignId: adSet.campaign_id ?? null,
    dailyBudgetCents: adSet.daily_budget ? Math.round(Number(adSet.daily_budget)) : null,
    adAccountId: adAccountExternalId,
  }));
}

export async function listMetaAds(
  accessToken: string,
  adAccountExternalId: string
): Promise<MetaAd[]> {
  const data = await metaFetch<{
    data?: Array<{
      id: string;
      name?: string;
      status?: string;
      effective_status?: string;
      adset_id?: string;
      campaign_id?: string;
    }>;
  }>(
    `/${actId(adAccountExternalId)}/ads?fields=id,name,status,effective_status,adset_id,campaign_id&limit=100`,
    accessToken
  );

  return (data.data ?? []).map((ad) => ({
    id: ad.id,
    name: ad.name ?? "Anúncio",
    status: ad.status ?? "UNKNOWN",
    effectiveStatus: ad.effective_status ?? ad.status ?? "UNKNOWN",
    adSetId: ad.adset_id ?? null,
    campaignId: ad.campaign_id ?? null,
    adAccountId: adAccountExternalId,
  }));
}

export async function listMetaCustomAudiences(
  accessToken: string,
  adAccountExternalId: string
): Promise<MetaAudience[]> {
  const data = await metaFetch<{
    data?: Array<{
      id: string;
      name?: string;
      approximate_count?: number;
      subtype?: string;
    }>;
  }>(
    `/${actId(adAccountExternalId)}/customaudiences?fields=id,name,approximate_count,subtype&limit=50`,
    accessToken
  );

  return (data.data ?? []).map((audience) => ({
    id: audience.id,
    name: audience.name ?? audience.id,
    approximateCount: audience.approximate_count ?? 0,
    subtype: audience.subtype ?? null,
    adAccountId: adAccountExternalId,
  }));
}
