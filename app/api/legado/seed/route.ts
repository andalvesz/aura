import { seedLegacyForUser } from "@/lib/supabase/services/legado.service";

export async function POST() {
  const { seeded, error } = await seedLegacyForUser();

  if (error === "Usuário não autenticado.") {
    return Response.json({ error }, { status: 401 });
  }

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ seeded });
}
