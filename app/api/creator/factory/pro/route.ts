import type { ProductFactoryProAction } from "@/utils/product-factory-pro";
import { sanitizeProductFactoryBundle } from "@/utils/product-factory-pro";
import { runProductFactoryProAction } from "@/lib/supabase/services/product-factory.service";

const VALID_ACTIONS: ProductFactoryProAction[] = [
  "improve",
  "regenerate_design",
  "expand_content",
  "premium",
];

const ACTION_ERROR_LABELS: Record<ProductFactoryProAction, string> = {
  improve: "melhorar produto",
  regenerate_design: "regenerar design",
  expand_content: "expandir conteúdo",
  premium: "gerar versão premium",
};

function formatProActionError(action: ProductFactoryProAction, message: string) {
  return `Erro ao ${ACTION_ERROR_LABELS[action]}: ${message}`;
}

export async function POST(request: Request) {
  let action: ProductFactoryProAction | undefined;
  let factoryId = "";

  try {
    const body = (await request.json()) as {
      factory_id?: string;
      action?: string;
    };

    factoryId = body.factory_id?.trim() ?? "";
    action = body.action?.trim() as ProductFactoryProAction | undefined;

    console.info("[product-pro] POST /api/creator/factory/pro", {
      factoryId,
      action,
    });

    if (!factoryId) {
      return Response.json({ error: "factory_id é obrigatório." }, { status: 400 });
    }

    if (!action || !VALID_ACTIONS.includes(action)) {
      return Response.json({ error: "action inválida." }, { status: 400 });
    }

    const { bundle, error } = await runProductFactoryProAction(factoryId, action, {
      source: "manual",
    });
    if (error) {
      console.error("[product-pro]", {
        factoryId,
        action,
        error,
      });
      return Response.json(
        {
          error: formatProActionError(action, error),
          detail: error,
          action,
          factory_id: factoryId,
        },
        { status: 400 }
      );
    }

    console.info("[product-pro] success", {
      factoryId,
      action,
      bundleId: bundle?.factory.id,
      score: bundle?.factory.conteudo
        ? (bundle.factory.conteudo as { quality_score?: number }).quality_score
        : undefined,
    });

    return Response.json({ bundle: sanitizeProductFactoryBundle(bundle) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    if (/maximum call stack size exceeded/i.test(message)) {
      console.error("[product-pro] stack overflow in route", { factoryId, action });
      return Response.json(
        {
          error: "Loop detectado ao melhorar produto. A ação foi bloqueada para evitar recursão.",
          detail: message,
          action,
          factory_id: factoryId,
        },
        { status: 500 }
      );
    }

    console.error("[product-pro]", {
      factoryId,
      action,
      error: message,
      stack,
    });

    const label = action ? ACTION_ERROR_LABELS[action] : "executar ação Pro";
    return Response.json(
      {
        error: `Erro ao ${label}: ${message}`,
        detail: message,
        stack,
        action,
        factory_id: factoryId,
      },
      { status: 500 }
    );
  }
}
