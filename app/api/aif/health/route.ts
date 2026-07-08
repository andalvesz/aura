import { NextResponse } from "next/server";
import { getAifHealth } from "@/lib/supabase/services/aif.service";

export async function GET() {
  const health = await getAifHealth();
  return NextResponse.json({
    service: "aura_intelligence_factory",
    status: health.ok ? "healthy" : "degraded",
    ...health,
  });
}
