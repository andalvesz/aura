import { assertOpenAiAvailable } from "@/lib/social/generate-roteiro";

export async function GET() {
  const unavailable = assertOpenAiAvailable();
  if (unavailable) {
    return Response.json({ available: false, reason: unavailable });
  }
  return Response.json({ available: true, reason: null });
}
