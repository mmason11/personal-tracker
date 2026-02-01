import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function refreshStravaToken(refreshToken: string) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  return res.json();
}

export async function POST(request: Request) {
  const { access_token, refresh_token, expires_at } = await request.json();

  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: "Missing tokens" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let currentAccessToken = access_token;

  // Refresh token if expired
  const now = Math.floor(Date.now() / 1000);
  if (expires_at && now >= expires_at) {
    const refreshed = await refreshStravaToken(refresh_token);
    if (refreshed.access_token) {
      currentAccessToken = refreshed.access_token;
      // Update tokens in profiles
      await supabase
        .from("profiles")
        .update({
          strava_access_token: refreshed.access_token,
          strava_refresh_token: refreshed.refresh_token,
          strava_token_expires_at: refreshed.expires_at,
        })
        .eq("id", user.id);
    } else {
      return NextResponse.json({ error: "Token refresh failed" }, { status: 401 });
    }
  }

  try {
    // Fetch recent activities (last 30 days, up to 100)
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const activitiesRes = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${thirtyDaysAgo}&per_page=100`,
      {
        headers: { Authorization: `Bearer ${currentAccessToken}` },
      }
    );

    if (!activitiesRes.ok) {
      if (activitiesRes.status === 401) {
        return NextResponse.json({ error: "Token expired. Please reconnect." }, { status: 401 });
      }
      throw new Error(`Strava API error: ${activitiesRes.status}`);
    }

    const activities = await activitiesRes.json();
    let synced = 0;
    let errors = 0;

    for (const activity of activities) {
      try {
        await supabase.from("strava_activities").upsert(
          {
            user_id: user.id,
            strava_activity_id: activity.id,
            name: activity.name || null,
            type: activity.type || null,
            start_date: activity.start_date || null,
            distance_meters: activity.distance || 0,
            moving_time_seconds: activity.moving_time || 0,
            elapsed_time_seconds: activity.elapsed_time || 0,
            total_elevation_gain: activity.total_elevation_gain || 0,
            average_speed: activity.average_speed || 0,
            max_speed: activity.max_speed || 0,
            average_watts: activity.average_watts || null,
            max_watts: activity.max_watts || null,
            average_heartrate: activity.average_heartrate || null,
            max_heartrate: activity.max_heartrate || null,
            calories: activity.calories || 0,
            gear_id: activity.gear_id || null,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "user_id,strava_activity_id" }
        );
        synced++;
      } catch {
        errors++;
      }
    }

    return NextResponse.json({ synced, errors, total: activities.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
