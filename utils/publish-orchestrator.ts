export type PublishOrchestratorMode = "master_flow" | "manual";

export type PublishOrchestratorResult = {
  funnelPublished: boolean;
  campaignPublished: boolean;
  funnelUrl: string | null;
  landingUrl: string | null;
  campaignId: string | null;
  messages: string[];
  warnings: string[];
};

export const PUBLISH_ORCHESTRATOR_MASTER_FLOW = {
  bypassExplicitApproval: false,
  publishFunnel: true,
  publishCampaign: true,
};
