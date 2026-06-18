import {
  createMetaAdCreative,
  listMetaPages,
  uploadMetaAdImage,
} from "@/lib/meta/meta.client";
import { decryptCredentials } from "@/lib/crypto/credentials";
import { CreativeGeneratedAssetsRepository } from "@/lib/supabase/repositories/creative-generated-assets.repository";
import { MetaUploadedAssetsRepository } from "@/lib/supabase/repositories/meta-uploaded-assets.repository";
import {
  MetaConnectionsRepository,
} from "@/lib/supabase/repositories/meta.repository";
import { AdPlatformConnectionsRepository } from "@/lib/supabase/repositories/ad-platform-connections.repository";
import { downloadRealCreativeAsset } from "@/lib/supabase/services/creative-generated-assets.service";
import { logIntegrationAction } from "@/lib/supabase/services/integration-logs.service";
import type { AdPlatformConnection, Json, MetaUploadedAsset, TableInsert } from "@/types/database";
import {
  isCreativeGeneratedAssetDelivered,
} from "@/utils/creative-generated-assets";
import {
  isMetaCreativeUploadEnabled,
  mergeMetaUploadMetadata,
  META_UPLOAD_SAFE_MODE,
  requiresExplicitMetaUploadApproval,
} from "@/utils/meta-upload";
import { getOptionalDataContext } from "./context";

function getMetaAccessToken(encrypted: string): string {
  const creds = decryptCredentials(encrypted);
  const token = creds.access_token?.trim();
  if (!token) throw new Error("Token Meta inválido.");
  return token;
}

function readMetaPageId(metadata: Json): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const pageId = (metadata as Record<string, unknown>).page_id;
  return typeof pageId === "string" && pageId.trim() ? pageId.trim() : null;
}

export type UploadMetaCreativeInput = {
  assetId: string;
  connection?: AdPlatformConnection | null;
  pageId?: string | null;
  linkUrl?: string;
  headline?: string | null;
  primaryText?: string | null;
  description?: string | null;
  ctaType?: string | null;
  explicitApproval?: boolean;
  skipApprovalGate?: boolean;
};

export async function uploadMetaCreative(
  input: UploadMetaCreativeInput
): Promise<{
  record: MetaUploadedAsset | null;
  metaCreativeId: string | null;
  message: string;
  error: string | null;
}> {
  const explicitApproval = input.explicitApproval === true;
  const skipApprovalGate = input.skipApprovalGate === true;

  if (!skipApprovalGate && requiresExplicitMetaUploadApproval() && !explicitApproval) {
    return {
      record: null,
      metaCreativeId: null,
      message: "",
      error: "Upload para Meta requer aprovação explícita (SAFE_MODE ativo).",
    };
  }

  if (!isMetaCreativeUploadEnabled()) {
    return {
      record: null,
      metaCreativeId: null,
      message: "",
      error: "Upload desabilitado. Defina ADS_PUBLISH_ENABLED=true para enviar assets à Meta.",
    };
  }

  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      record: null,
      metaCreativeId: null,
      message: "",
      error: "Usuário não autenticado.",
    };
  }

  const assetId = input.assetId.trim();
  if (!assetId) {
    return {
      record: null,
      metaCreativeId: null,
      message: "",
      error: "Informe asset_id.",
    };
  }

  const uploadRepo = new MetaUploadedAssetsRepository(ctx.supabase, ctx.userId);
  const { data: existing } = await uploadRepo.findByAssetId(assetId);
  if (existing?.meta_creative_id) {
    return {
      record: existing,
      metaCreativeId: existing.meta_creative_id,
      message: "Asset já enviado para Meta.",
      error: null,
    };
  }

  const assetRepo = new CreativeGeneratedAssetsRepository(ctx.supabase, ctx.userId);
  const { data: asset, error: assetError } = await assetRepo.findById(assetId);
  if (assetError || !asset) {
    return {
      record: null,
      metaCreativeId: null,
      message: "",
      error: assetError ?? "Asset gerado não encontrado.",
    };
  }

  if (!isCreativeGeneratedAssetDelivered(asset.status)) {
    return {
      record: null,
      metaCreativeId: null,
      message: "",
      error: "Apenas assets com status delivered podem ser enviados à Meta.",
    };
  }

  if (asset.creative_id) {
    const { requireExcellenceDelivery } = await import("./excellence-integration.service");
    const gate = await requireExcellenceDelivery("creative", asset.creative_id, {
      module: "ads-commander",
    });
    if (!gate.allowed) {
      return {
        record: null,
        metaCreativeId: null,
        message: "",
        error: gate.error ?? "Asset bloqueado pelo Excellence Engine.",
      };
    }
  }

  const metaConnRepo = new MetaConnectionsRepository(ctx.supabase, ctx.userId);
  const { data: metaConnection } = await metaConnRepo.findForUser();
  if (!metaConnection || metaConnection.status !== "connected") {
    return {
      record: null,
      metaCreativeId: null,
      message: "",
      error: "Conecte Meta Business em Platform Hub antes de enviar assets.",
    };
  }

  let connection = input.connection ?? null;
  if (!connection) {
    const platformRepo = new AdPlatformConnectionsRepository(ctx.supabase, ctx.userId);
    connection = (await platformRepo.findDefaultForPlatform("meta")).data;
  }

  if (!connection || connection.status !== "connected") {
    return {
      record: null,
      metaCreativeId: null,
      message: "",
      error: "Conta Meta Ads não conectada.",
    };
  }

  const token = getMetaAccessToken(metaConnection.access_token_encrypted);
  const accountId = connection.external_account_id;

  let pageId = input.pageId?.trim() || readMetaPageId(connection.metadata);
  if (!pageId) {
    const pages = await listMetaPages(token);
    pageId = pages[0]?.id ?? null;
    if (!pageId) {
      return {
        record: null,
        metaCreativeId: null,
        message: "",
        error: "Nenhuma página Meta vinculada — necessária para criar criativo.",
      };
    }
  }

  const assetMeta = asset.metadata as Record<string, unknown> | null;
  const headline =
    input.headline?.trim() ||
    (typeof assetMeta?.title === "string" ? assetMeta.title : null) ||
    "Criativo Aura";
  const primaryText =
    input.primaryText?.trim() ||
    (typeof assetMeta?.copy === "string" ? assetMeta.copy : null) ||
    headline;
  const linkUrl = input.linkUrl?.trim() || "https://example.com";

  const { buffer, mimeType, error: downloadError } = await downloadRealCreativeAsset(assetId);
  if (downloadError || !buffer) {
    return {
      record: null,
      metaCreativeId: null,
      message: "",
      error: downloadError ?? "Erro ao baixar asset do Storage.",
    };
  }

  try {
    const { imageHash } = await uploadMetaAdImage(token, accountId, buffer, mimeType);
    const { externalCreativeId } = await createMetaAdCreative(token, accountId, {
      name: headline,
      pageId,
      linkUrl,
      headline,
      primaryText,
      description: input.description ?? primaryText.slice(0, 200),
      ctaType: input.ctaType ?? undefined,
      imageHash,
    });

    const payload = {
      asset_id: assetId,
      meta_creative_id: externalCreativeId,
      uploaded_at: new Date().toISOString(),
      metadata: mergeMetaUploadMetadata({}, {
        image_hash: imageHash,
        page_id: pageId,
        link_url: linkUrl,
        safe_mode: META_UPLOAD_SAFE_MODE.active,
        explicit_approval: explicitApproval,
      }),
    } satisfies Omit<TableInsert<"meta_uploaded_assets">, "user_id">;

    const { data: record, error: insertError } = await uploadRepo.create(payload);
    if (insertError || !record) {
      return {
        record: null,
        metaCreativeId: externalCreativeId,
        message: "",
        error: insertError ?? "Erro ao registrar upload na Meta.",
      };
    }

    await logIntegrationAction({
      platform: "meta",
      actionType: "upload_creative",
      status: "success",
      message: `Asset ${assetId.slice(0, 8)} enviado para Meta.`,
      details: {
        assetId,
        metaCreativeId: externalCreativeId,
        imageHash,
        connectionId: connection.id,
      },
    });

    return {
      record,
      metaCreativeId: externalCreativeId,
      message: `Asset enviado para Meta (criativo ${externalCreativeId}).`,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao enviar asset para Meta.";
    await logIntegrationAction({
      platform: "meta",
      actionType: "upload_creative",
      status: "error",
      message,
      details: { assetId },
    });
    return {
      record: null,
      metaCreativeId: null,
      message: "",
      error: message,
    };
  }
}

export async function resolveMetaCreativeIdForAsset(
  assetId: string,
  uploadInput: Omit<UploadMetaCreativeInput, "assetId">
): Promise<{ metaCreativeId: string | null; error: string | null }> {
  const result = await uploadMetaCreative({
    ...uploadInput,
    assetId,
    skipApprovalGate: true,
    explicitApproval: uploadInput.explicitApproval ?? true,
  });

  return {
    metaCreativeId: result.metaCreativeId,
    error: result.error,
  };
}
