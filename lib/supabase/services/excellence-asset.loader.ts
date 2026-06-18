import { AdCampaignsRepository } from "@/lib/supabase/repositories/ad-campaigns.repository";
import { CreatorCopylabRepository } from "@/lib/supabase/repositories/copylab.repository";
import { CreativeAssetsRepository } from "@/lib/supabase/repositories/creative-factory.repository";
import { FunnelsRepository } from "@/lib/supabase/repositories/funnel-engine.repository";
import { LandingPagesRepository } from "@/lib/supabase/repositories/landing-factory.repository";
import { OffersRepository } from "@/lib/supabase/repositories/offer-engine.repository";
import { ProductFactoryRepository } from "@/lib/supabase/repositories/product-factory.repository";
import { CreatorProductsRepository } from "@/lib/supabase/repositories/creator.repository";
import type { ExcellenceAssetType } from "@/types/database";
import { buildExcellenceAssetLabel } from "@/utils/aura-excellence";
import { getOptionalDataContext } from "./context";

export type AssetContentBundle = {
  content: string;
  label: string;
};

export async function loadAssetContent(
  assetType: ExcellenceAssetType,
  assetId: string
): Promise<{ bundle: AssetContentBundle | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { bundle: null, error: "Usuário não autenticado." };

  switch (assetType) {
    case "product": {
      const repo = new CreatorProductsRepository(ctx.supabase, ctx.userId);
      const { data } = await repo.findById(assetId);
      if (!data) return { bundle: null, error: "Produto não encontrado." };
      return {
        bundle: {
          label: data.nome ?? buildExcellenceAssetLabel(assetType, assetId),
          content: [
            `Nome: ${data.nome ?? "—"}`,
            `Promessa: ${data.promessa ?? "—"}`,
            `Problema: ${data.problema ?? "—"}`,
            `Solução: ${data.solucao ?? "—"}`,
            `Público: ${data.publico_alvo ?? "—"}`,
            `Nicho: ${data.nicho ?? "—"}`,
          ].join("\n"),
        },
        error: null,
      };
    }
    case "ebook": {
      const repo = new ProductFactoryRepository(ctx.supabase, ctx.userId);
      const { data } = await repo.findById(assetId);
      if (!data) return { bundle: null, error: "E-book não encontrado." };
      const conteudo =
        typeof data.conteudo === "string"
          ? data.conteudo
          : JSON.stringify(data.conteudo ?? {}).slice(0, 3000);
      return {
        bundle: {
          label: data.titulo ?? buildExcellenceAssetLabel(assetType, assetId),
          content: [
            `Título: ${data.titulo ?? "—"}`,
            `Promessa: ${data.promessa ?? "—"}`,
            `Tipo: ${data.product_type ?? "ebook"}`,
            `Conteúdo: ${conteudo}`,
          ].join("\n"),
        },
        error: null,
      };
    }
    case "copy": {
      const repo = new CreatorCopylabRepository(ctx.supabase, ctx.userId);
      const { data } = await repo.findById(assetId);
      if (!data) return { bundle: null, error: "Copy não encontrada." };
      return {
        bundle: {
          label: data.headline ?? buildExcellenceAssetLabel(assetType, assetId),
          content: [
            `Headline: ${data.headline ?? "—"}`,
            `Subheadline: ${data.subheadline ?? "—"}`,
            `Bullets: ${Array.isArray(data.bullets) ? data.bullets.join("; ") : "—"}`,
            `CTA: ${data.cta ?? "—"}`,
            `Promessa: ${data.promessa ?? "—"}`,
            `Página de vendas: ${data.pagina_vendas ?? "—"}`,
          ].join("\n"),
        },
        error: null,
      };
    }
    case "creative": {
      const repo = new CreativeAssetsRepository(ctx.supabase, ctx.userId);
      const { data } = await repo.findById(assetId);
      if (!data) return { bundle: null, error: "Criativo não encontrado." };
      return {
        bundle: {
          label: data.title ?? buildExcellenceAssetLabel(assetType, assetId),
          content: [
            `Tipo: ${data.asset_type}`,
            `Título: ${data.title ?? "—"}`,
            `Copy: ${data.copy ?? "—"}`,
            `Prompt: ${data.prompt ?? "—"}`,
            `Formato: ${data.format ?? "—"}`,
          ].join("\n"),
        },
        error: null,
      };
    }
    case "landing": {
      const repo = new LandingPagesRepository(ctx.supabase, ctx.userId);
      const { data } = await repo.findById(assetId);
      if (!data) return { bundle: null, error: "Landing page não encontrada." };
      return {
        bundle: {
          label: data.title ?? buildExcellenceAssetLabel(assetType, assetId),
          content: [
            `Título: ${data.title ?? "—"}`,
            `Headline: ${data.headline ?? "—"}`,
            `Subheadline: ${data.subheadline ?? "—"}`,
            `CTA: ${data.cta_text ?? "—"}`,
            `Hero: ${data.hero_copy ?? "—"}`,
            `HTML: ${typeof data.html === "string" ? data.html.slice(0, 2000) : "—"}`,
          ].join("\n"),
        },
        error: null,
      };
    }
    case "offer": {
      const repo = new OffersRepository(ctx.supabase, ctx.userId);
      const { data } = await repo.findById(assetId);
      if (!data) return { bundle: null, error: "Oferta não encontrada." };
      return {
        bundle: {
          label: data.title ?? buildExcellenceAssetLabel(assetType, assetId),
          content: [
            `Título: ${data.title ?? "—"}`,
            `Tipo: ${data.offer_type}`,
            `Preço: ${data.price ?? "—"}`,
            `Descrição: ${data.description ?? "—"}`,
            `Take rate esperado: ${data.expected_take_rate ?? "—"}`,
          ].join("\n"),
        },
        error: null,
      };
    }
    case "funnel": {
      const repo = new FunnelsRepository(ctx.supabase, ctx.userId);
      const { data } = await repo.findById(assetId);
      if (!data) return { bundle: null, error: "Funil não encontrado." };
      return {
        bundle: {
          label: data.funnel_name ?? buildExcellenceAssetLabel(assetType, assetId),
          content: [
            `Nome: ${data.funnel_name ?? "—"}`,
            `Tipo: ${data.funnel_type ?? "—"}`,
            `Nicho: ${data.niche ?? "—"}`,
            `Etapas: ${data.total_steps}`,
            `Conversão esperada: ${data.expected_conversion ?? "—"}`,
            `AOV esperado: ${data.expected_aov ?? "—"}`,
          ].join("\n"),
        },
        error: null,
      };
    }
    case "campaign": {
      const repo = new AdCampaignsRepository(ctx.supabase, ctx.userId);
      const { data } = await repo.findById(assetId);
      if (!data) return { bundle: null, error: "Campanha não encontrada." };
      return {
        bundle: {
          label: data.campaign_name ?? buildExcellenceAssetLabel(assetType, assetId),
          content: [
            `Nome: ${data.campaign_name ?? "—"}`,
            `Plataforma: ${data.platform}`,
            `Objetivo: ${data.objective ?? "—"}`,
            `Status: ${data.status}`,
            `Orçamento: ${data.budget ?? "—"}`,
            `Copy: ${JSON.stringify(data.copy_json ?? {}).slice(0, 2000)}`,
          ].join("\n"),
        },
        error: null,
      };
    }
    case "strategy": {
      return {
        bundle: {
          label: buildExcellenceAssetLabel(assetType, assetId),
          content: `Estratégia registrada (ID: ${assetId}). Avalie coerência de posicionamento, funil e monetização.`,
        },
        error: null,
      };
    }
    default:
      return { bundle: null, error: "Tipo de ativo inválido." };
  }
}
