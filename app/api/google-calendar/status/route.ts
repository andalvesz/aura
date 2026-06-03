import { getGoogleCalendarPublicStatus } from "@/lib/google-calendar";

export async function GET() {
  try {
    const status = await getGoogleCalendarPublicStatus();
    return Response.json(status);
  } catch (error) {
    console.error("[google-calendar/status]", error);
    return Response.json(
      { connected: false, configured: false, email: null, calendarId: null },
      { status: 500 }
    );
  }
}
