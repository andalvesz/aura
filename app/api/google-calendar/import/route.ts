import { importGoogleCalendarEvents } from "@/lib/google-calendar";

export async function POST() {
  try {
    const result = await importGoogleCalendarEvents();

    if (result.error) {
      const status =
        result.error === "Usuário não autenticado."
          ? 401
          : result.error.includes("não conectado")
            ? 400
            : 422;
      return Response.json(result, { status });
    }

    return Response.json(result);
  } catch (error) {
    console.error("[google-calendar/import]", error);
    return Response.json(
      { imported: 0, updated: 0, error: "Erro ao importar eventos." },
      { status: 500 }
    );
  }
}
