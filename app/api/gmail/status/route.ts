import { getGmailPublicStatus } from "@/lib/comms/gmail.service";

export async function GET() {
  try {
    const status = await getGmailPublicStatus();
    return Response.json(status);
  } catch (error) {
    console.error("[gmail/status]", error);
    return Response.json(
      { connected: false, configured: false, email: null },
      { status: 500 }
    );
  }
}
