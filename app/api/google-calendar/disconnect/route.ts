import { deleteGoogleCalendarConnection } from "@/lib/google-calendar";

export async function POST() {
  try {
    const { error } = await deleteGoogleCalendarConnection();
    if (error === "Usuário não autenticado.") {
      return Response.json({ error }, { status: 401 });
    }
    if (error) {
      return Response.json({ error }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[google-calendar/disconnect]", error);
    return Response.json({ error: "Erro ao desconectar." }, { status: 500 });
  }
}
