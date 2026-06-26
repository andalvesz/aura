const QUEUE_TEST_STEP = 1 as 1 | 2 | 3;

export async function POST() {
  const worker = await import("@/lib/supabase/services/expert-brain-ingestion.service");

  if (QUEUE_TEST_STEP === 1) {
    return Response.json({
      success: true,
      step: "import ok",
      exports: Object.keys(worker),
    });
  }

  if (QUEUE_TEST_STEP === 2) {
    await worker.processExpertBrainIngestionQueue(0);
    return Response.json({
      success: true,
      step: "queue 0 ok",
    });
  }

  await worker.processExpertBrainIngestionQueue(1);
  return Response.json({
    success: true,
    step: "queue 1 ok",
  });
}
