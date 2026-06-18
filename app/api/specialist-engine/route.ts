import {
  getSpecialistEngineContext,
  loadSpecialistCatalog,
} from "@/lib/supabase/services/specialist-engine.service";

export async function GET() {
  const [{ specialists, error }, { context, error: contextError }] = await Promise.all([
    loadSpecialistCatalog(),
    getSpecialistEngineContext(),
  ]);

  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ specialists, context, contextError });
}
