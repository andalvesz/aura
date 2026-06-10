import {
  deletePlatformConnection,
  disconnectPlatform,
  getPlatformsDashboard,
} from "@/lib/supabase/services/platform-hub.service";

export async function GET() {
  const { dashboard, connections, products, syncLogs, analyses, error } =
    await getPlatformsDashboard();

  if (error) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 500 }
    );
  }

  return Response.json({ dashboard, connections, products, syncLogs, analyses });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const platform = searchParams.get("platform");

  if (platform) {
    const { error } = await disconnectPlatform(platform as never);
    if (error) {
      return Response.json(
        { error },
        { status: error === "Usuário não autenticado." ? 401 : 500 }
      );
    }
    return Response.json({ ok: true });
  }

  if (!id) {
    return Response.json({ error: "Informe id ou platform." }, { status: 400 });
  }

  const { error } = await deletePlatformConnection(id);
  if (error) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 500 }
    );
  }

  return Response.json({ ok: true });
}
