import { recordSystemLog } from "@/lib/logs/record";
import {
  FunnelStepsRepository,
  FunnelsRepository,
} from "@/lib/supabase/repositories/funnel-engine.repository";
import { FunnelPagesRepository } from "@/lib/supabase/repositories/funnel-pages.repository";
import { FunnelPublishLogsRepository } from "@/lib/supabase/repositories/funnel-publish.repository";
import { LandingPagesRepository } from "@/lib/supabase/repositories/landing-factory.repository";
import { publishLandingPage } from "@/lib/supabase/services/landing-factory.service";
import type { FunnelPublishStatus, Json } from "@/types/database";
import {
  computeFunnelPublishStatus,
  FUNNEL_PUBLISH_ORDER,
  funnelPublishPageLabel,
  funnelPublishStepType,
  mergeFunnelPageMetadata,
  resolvePageForPublishKey,
  type FunnelPublishPageResult,
  type FunnelPublishResult,
} from "@/utils/funnel-pages";
import { getOptionalDataContext } from "./context";

function readLandingPublishedAt(metadata: Json): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const publishedAt = (metadata as Record<string, unknown>).published_at;
  return typeof publishedAt === "string" ? publishedAt : null;
}

export async function publishFunnel(funnelId: string): Promise<{
  result: FunnelPublishResult | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { result: null, error: "Usuário não autenticado." };

  const funnelIdTrim = funnelId.trim();
  if (!funnelIdTrim) return { result: null, error: "Informe funnel_id." };

  const funnelsRepo = new FunnelsRepository(ctx.supabase, ctx.userId);
  const pagesRepo = new FunnelPagesRepository(ctx.supabase, ctx.userId);
  const stepsRepo = new FunnelStepsRepository(ctx.supabase, ctx.userId);
  const logsRepo = new FunnelPublishLogsRepository(ctx.supabase, ctx.userId);
  const landingRepo = new LandingPagesRepository(ctx.supabase, ctx.userId);

  const { data: funnel } = await funnelsRepo.findById(funnelIdTrim);
  if (!funnel) return { result: null, error: "Funil não encontrado." };

  const { data: pages } = await pagesRepo.findByFunnelId(funnelIdTrim);
  if (!pages?.length) {
    return { result: null, error: "Nenhuma página gerada para este funil." };
  }

  const startedAt = new Date().toISOString();
  const { data: log, error: logError } = await logsRepo.create({
    funnel_id: funnelIdTrim,
    status: "publishing",
    page_results: [],
    metadata: { started_at: startedAt },
  });

  if (logError || !log) {
    return { result: null, error: logError ?? "Erro ao iniciar publicação do funil." };
  }

  const pageResults: FunnelPublishPageResult[] = [];

  for (const key of FUNNEL_PUBLISH_ORDER) {
    const label = funnelPublishPageLabel(key);
    const page = resolvePageForPublishKey(pages, key);

    if (!page) {
      pageResults.push({
        key,
        label,
        funnel_page_id: null,
        landing_page_id: null,
        status: "skipped",
        url: null,
        published_at: null,
        error: "Página não gerada.",
      });
      continue;
    }

    if (!page.landing_page_id) {
      pageResults.push({
        key,
        label,
        funnel_page_id: page.id,
        landing_page_id: null,
        status: "failed",
        url: null,
        published_at: null,
        error: "Sem landing vinculada.",
      });
      continue;
    }

    if (page.status === "published") {
      const { data: landing } = await landingRepo.findById(page.landing_page_id);
      pageResults.push({
        key,
        label,
        funnel_page_id: page.id,
        landing_page_id: page.landing_page_id,
        status: "already_published",
        url: landing?.published_url ?? null,
        published_at: readLandingPublishedAt(landing?.metadata ?? {}),
        error: null,
      });
      continue;
    }

    const { page: landing, error: publishError } = await publishLandingPage(page.landing_page_id);
    if (publishError || !landing) {
      pageResults.push({
        key,
        label,
        funnel_page_id: page.id,
        landing_page_id: page.landing_page_id,
        status: "failed",
        url: null,
        published_at: null,
        error: publishError ?? "Erro ao publicar landing.",
      });
      continue;
    }

    const publishedAt = new Date().toISOString();
    await pagesRepo.update(page.id, {
      status: "published",
      metadata: mergeFunnelPageMetadata(page.metadata, {
        published_at: publishedAt,
        published_url: landing.published_url,
      }),
    });

    pageResults.push({
      key,
      label,
      funnel_page_id: page.id,
      landing_page_id: landing.id,
      status: "published",
      url: landing.published_url,
      published_at: publishedAt,
      error: null,
    });
  }

  const overallStatus = computeFunnelPublishStatus(pageResults);
  const publishedAt =
    pageResults.some(
      (page) => page.status === "published" || page.status === "already_published"
    )
      ? new Date().toISOString()
      : null;

  const logStatus: FunnelPublishStatus =
    overallStatus === "published"
      ? "published"
      : overallStatus === "partial"
        ? "partial"
        : "failed";

  await logsRepo.update(log.id, {
    status: logStatus,
    published_at: publishedAt,
    page_results: pageResults as unknown as Json,
    metadata: {
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      success_count: pageResults.filter(
        (page) => page.status === "published" || page.status === "already_published"
      ).length,
      failure_count: pageResults.filter(
        (page) => page.status === "failed" || page.status === "skipped"
      ).length,
    },
  });

  const { data: steps } = await stepsRepo.findByFunnelId(funnelIdTrim);
  for (const pageResult of pageResults) {
    if (
      !pageResult.landing_page_id ||
      pageResult.status === "failed" ||
      pageResult.status === "skipped"
    ) {
      continue;
    }

    const step = steps?.find((item) => item.step_type === funnelPublishStepType(pageResult.key));
    if (step) {
      await stepsRepo.updateStep(step.id, {
        landing_id: pageResult.landing_page_id,
        status: "active",
      });
    }
  }

  const publishedUrls = Object.fromEntries(
    pageResults
      .filter((page) => page.url)
      .map((page) => [page.key, page.url as string])
  );

  await funnelsRepo.update(funnelIdTrim, {
    status: overallStatus === "failed" ? funnel.status : "active",
    metadata: mergeFunnelPageMetadata(funnel.metadata, {
      publish: {
        status: overallStatus,
        published_at: publishedAt,
        urls: publishedUrls,
        log_id: log.id,
      },
    }) as Json,
  });

  recordSystemLog({
    tipo: "info",
    modulo: "funnel-pages",
    mensagem: `Funil publicado: ${funnel.funnel_name} (${overallStatus})`,
    detalhes: {
      funnelId: funnelIdTrim,
      logId: log.id,
      status: overallStatus,
      pages: pageResults.map((page) => ({
        key: page.key,
        status: page.status,
        url: page.url,
      })),
    },
  });

  return {
    result: {
      funnel_id: funnelIdTrim,
      status: overallStatus,
      published_at: publishedAt,
      pages: pageResults,
      log_id: log.id,
    },
    error: overallStatus === "failed" ? "Nenhuma página foi publicada." : null,
  };
}
