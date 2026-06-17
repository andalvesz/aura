import {
  registerCampaignResult,
  registerCopyResult,
  registerCreativeResult,
  registerLandingResult,
} from "@/lib/supabase/services/growth-brain.service";
import type { GrowthResultInput } from "@/utils/growth-brain";

type RegisterBody = GrowthResultInput & {
  type?: "campaign" | "creative" | "landing" | "copy";
};

export async function POST(request: Request) {
  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const type = body.type ?? "campaign";
  let result;

  switch (type) {
    case "copy":
      result = await registerCopyResult(body);
      break;
    case "creative":
      result = await registerCreativeResult(body);
      break;
    case "landing":
      result = await registerLandingResult(body);
      break;
    case "campaign":
    default:
      result = await registerCampaignResult(body);
      break;
  }

  if (result.error) {
    const status =
      result.error === "Usuário não autenticado."
        ? 401
        : result.error.includes("obrigatório")
          ? 422
          : 500;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json({ memory: result.memory, message: "Resultado registrado no Growth Brain." });
}
