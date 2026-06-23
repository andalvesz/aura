import { disconnectGoogleDriveExpert } from "@/lib/supabase/services/google-drive.service";

export async function POST() {
  const { error } = await disconnectGoogleDriveExpert();

  if (error === "Usuário não autenticado.") {
    return Response.json({ error }, { status: 401 });
  }

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ ok: true });
}
