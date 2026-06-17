import { getLandingPageBySlug } from "@/lib/supabase/services/landing-factory.service";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const { page, error } = await getLandingPageBySlug(slug);

  if (error) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 500 }
    );
  }

  if (!page) {
    return Response.json({ error: "Landing não encontrada." }, { status: 404 });
  }

  if (page.status !== "published") {
    return Response.json({
      page,
      preview: true,
      message: "Preview interno — landing ainda não publicada.",
    });
  }

  return Response.json({ page, preview: false });
}
