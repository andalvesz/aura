import type { ProductFactoryProAction } from "@/utils/product-factory-pro";
import {
  runProductFactoryProAction,
} from "@/lib/supabase/services/product-factory.service";

const VALID_ACTIONS: ProductFactoryProAction[] = [
  "improve",
  "regenerate_design",
  "expand_content",
  "premium",
];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      factory_id?: string;
      action?: string;
    };

    const factoryId = body.factory_id?.trim() ?? "";
    const action = body.action?.trim() as ProductFactoryProAction | undefined;

    if (!factoryId) {
      return Response.json({ error: "factory_id é obrigatório." }, { status: 400 });
    }

    if (!action || !VALID_ACTIONS.includes(action)) {
      return Response.json({ error: "action inválida." }, { status: 400 });
    }

    const { bundle, error } = await runProductFactoryProAction(factoryId, action);
    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    return Response.json({ bundle });
  } catch {
    return Response.json({ error: "Erro na ação Pro." }, { status: 500 });
  }
}
