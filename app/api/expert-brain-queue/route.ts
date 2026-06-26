export async function POST() {
  console.log("[queue] start POST");

  try {
    console.log("[queue] before import expert-brain-ingestion.service");
    await import("@/lib/supabase/services/expert-brain-ingestion.service");
    console.log("[queue] imported expert-brain-ingestion.service");

    return Response.json({
      success: true,
      message: "worker imported",
    });
  } catch (err) {
    console.error("FAILED import expert-brain-ingestion.service", err);
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack ?? null : null;
    return Response.json(
      { success: false, error: message, stack, step: "import expert-brain-ingestion.service" },
      { status: 500 }
    );
  }
}
