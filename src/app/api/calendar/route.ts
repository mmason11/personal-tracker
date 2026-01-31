import { NextResponse } from "next/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.NEXT_PUBLIC_URL
  ? `${process.env.NEXT_PUBLIC_URL}/api/calendar/callback`
  : "http://localhost:3000/api/calendar/callback";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "auth") {
    const scope = encodeURIComponent(
      "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events"
    );
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    return NextResponse.json({ authUrl });
  }

  if (action === "events") {
    const token = searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 });
    }

    try {
      const now = new Date();
      const timeMin = now.toISOString();
      const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const timeMax = future.toISOString();

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        return NextResponse.json(
          { error: "Failed to fetch calendar events" },
          { status: res.status }
        );
      }

      const data = await res.json();
      const events = (data.items || []).map(
        (event: {
          id: string;
          summary?: string;
          start: { dateTime?: string; date?: string };
          end: { dateTime?: string; date?: string };
        }) => ({
          id: event.id,
          summary: event.summary || "Untitled",
          start: event.start.dateTime || event.start.date || "",
          end: event.end.dateTime || event.end.date || "",
          source: "google" as const,
        })
      );

      return NextResponse.json(events);
    } catch (error) {
      console.error("Calendar API error:", error);
      return NextResponse.json(
        { error: "Calendar API error" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function POST(request: Request) {
  const body = await request.json();

  if (body.action === "token") {
    const { code } = body;
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });
      const data = await res.json();
      return NextResponse.json(data);
    } catch (error) {
      console.error("Token exchange error:", error);
      return NextResponse.json({ error: "Token exchange failed" }, { status: 500 });
    }
  }

  if (body.action === "refresh") {
    const { refresh_token } = body;
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          grant_type: "refresh_token",
        }),
      });
      const data = await res.json();
      return NextResponse.json(data);
    } catch (error) {
      console.error("Token refresh error:", error);
      return NextResponse.json({ error: "Token refresh failed" }, { status: 500 });
    }
  }

  // Create a single event
  if (body.action === "create") {
    const { token, event } = body;
    if (!token) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }
    try {
      const res = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json({ error: data.error?.message || "Failed to create event" }, { status: res.status });
      }
      return NextResponse.json(data);
    } catch (error) {
      console.error("Create event error:", error);
      return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
    }
  }

  // Batch create events
  if (body.action === "sync") {
    const { token, events } = body;
    if (!token) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const results: { deleted: number; created: number; errors: number } = {
      deleted: 0,
      created: 0,
      errors: 0,
    };

    // Delete all existing [Routine] and [Game] events first
    const now = new Date();
    const past = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const timeMin = past.toISOString();
    const future = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const timeMax = future.toISOString();

    try {
      const existingRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&maxResults=2500`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (existingRes.ok) {
        const existingData = await existingRes.json();
        const syncedEvents = (existingData.items || []).filter(
          (e: { summary?: string }) =>
            e.summary?.startsWith("[Routine]") || e.summary?.startsWith("[Game]")
        );

        for (const evt of syncedEvents) {
          try {
            const delRes = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/primary/events/${evt.id}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              }
            );
            if (delRes.ok || delRes.status === 204) {
              results.deleted++;
            }
          } catch {
            // Continue deleting others
          }
        }
      }
    } catch {
      // Continue with creation even if delete fails
    }

    // Create all new events
    for (const event of events) {
      try {
        const res = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(event),
          }
        );
        if (res.ok) {
          results.created++;
        } else {
          results.errors++;
        }
      } catch {
        results.errors++;
      }
    }

    return NextResponse.json(results);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
