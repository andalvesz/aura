import { runAuraDiagnostics } from "@/lib/diagnostics/run-diagnostics";

export async function POST() {
  try {
    const report = await runAuraDiagnostics();
    return Response.json({ report });
  } catch (error) {
    console.error("[diagnostics]", error);
    return Response.json(
      { error: "Falha ao executar diagnóstico." },
      { status: 500 }
    );
  }
}
