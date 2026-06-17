import { publishLandingPage } from "@/lib/supabase/services/landing-factory.service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { landingId?: string };
    const landingId = body.landingId?.trim();

    if (!landingId) {
      return Response.json({ error: "landingId é obrigatório." }, { status: 400 });
    }

    const { page, message, error } = await publishLandingPage(landingId);

    if (error) {
      return Response.json({ error, page }, { status: 400 });
    }

    return Response.json({ page, message });
  } catch {
    return Response.json({ error: "Erro ao publicar landing." }, { status: 500 });
  }
}
