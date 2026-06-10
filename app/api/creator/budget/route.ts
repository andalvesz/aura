import {
  budgetSourceLabel,
  getResolvedUserBudget,
  updateUserAvailableBudget,
  type BudgetScope,
} from "@/lib/supabase/services/campaign-budget.service";
import { parseBudgetInput } from "@/utils/campaign-budget";
import { parseRequestJson } from "@/utils/safe-json";

export async function GET() {
  const { budget, moneyPlan, error } = await getResolvedUserBudget();
  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({
    budget,
    sourceLabel: budgetSourceLabel(budget.source),
    moneyPlanId: moneyPlan?.id ?? null,
  });
}

export async function PATCH(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      orcamento_disponivel?: number | string;
      scope?: BudgetScope;
      entity_id?: string | null;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const orcamento = parseBudgetInput(body.orcamento_disponivel ?? null);
    if (orcamento == null) {
      return Response.json({ error: "Informe um orçamento válido." }, { status: 400 });
    }

    const { budget, error } = await updateUserAvailableBudget({
      orcamento_disponivel: orcamento,
      scope: body.scope,
      entity_id: body.entity_id ?? null,
    });

    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    return Response.json({ budget, sourceLabel: budgetSourceLabel(budget.source) });
  } catch {
    return Response.json({ error: "Erro ao salvar orçamento." }, { status: 500 });
  }
}
