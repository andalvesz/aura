import { startMoneyMission } from "@/lib/supabase/services/money.service";
import type { MoneyPrazo, MoneyPrioridade } from "@/utils/money";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      valorMeta?: number;
      prazo?: MoneyPrazo;
      prioridade?: MoneyPrioridade;
    };

    const valorMeta = Number(body.valorMeta);
    const prazo = body.prazo;
    const prioridade = body.prioridade;

    if (!prazo || !prioridade) {
      return Response.json({ error: "Prazo e prioridade são obrigatórios." }, { status: 400 });
    }

    const { plan, tasks, error } = await startMoneyMission({
      valorMeta,
      prazo,
      prioridade,
    });

    if (error) {
      return Response.json({ error }, { status: 400 });
    }

    return Response.json({ plan, tasks });
  } catch {
    return Response.json({ error: "Erro ao criar plano financeiro." }, { status: 500 });
  }
}
