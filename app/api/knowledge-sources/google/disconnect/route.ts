import { disconnectGoogleDrive } from "@/lib/supabase/services/knowledge-sources.service";

export async function POST() {
  const { error } = await disconnectGoogleDrive();

  if (error === "Usuário não autenticado.") {
    return Response.json({ error }, { status: 401 });
  }

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ ok: true });
}
