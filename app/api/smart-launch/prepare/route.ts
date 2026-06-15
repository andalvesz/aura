import { prepareSmartLaunch } from "@/lib/supabase/services/smart-launch.service";
import type { SmartLaunchIntake } from "@/utils/smart-launch";

export async function POST(request: Request) {
  let body: SmartLaunchIntake;
  try {
    body = (await request.json()) as SmartLaunchIntake;
  } catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { session, center, error } = await prepareSmartLaunch(body);
  if (error) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 400 }
    );
  }

  return Response.json({ session, center });
}
