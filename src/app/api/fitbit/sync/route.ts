import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const FITBIT_API = "https://api.fitbit.com";
const STALE_TODAY_MS = 2 * 60 * 60 * 1000; // 2 hours
const STALE_PAST_MS = 24 * 60 * 60 * 1000; // 24 hours

async function refreshFitbitToken(refreshToken: string) {
  const clientId = process.env.FITBIT_CLIENT_ID!;
  const clientSecret = process.env.FITBIT_CLIENT_SECRET!;

  const res = await fetch("https://api.fitbit.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  return res.json();
}

async function fitbitFetch(endpoint: string, token: string) {
  const res = await fetch(`${FITBIT_API}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = new Error(`Fitbit API error: ${res.status}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function POST(request: Request) {
  const { access_token, refresh_token, dates } = await request.json();

  if (!access_token || !dates || !Array.isArray(dates)) {
    return NextResponse.json({ error: "Missing access_token or dates" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let currentToken = access_token;
  let tokenRefreshed = false;

  // Try to refresh the token proactively if we have a refresh token
  // and check stored expiry
  if (refresh_token) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("fitbit_token_expires_at")
      .eq("id", user.id)
      .maybeSingle();

    const now = Math.floor(Date.now() / 1000);
    if (profile?.fitbit_token_expires_at && now >= profile.fitbit_token_expires_at) {
      const refreshed = await refreshFitbitToken(refresh_token);
      if (refreshed.access_token) {
        currentToken = refreshed.access_token;
        tokenRefreshed = true;
        await supabase
          .from("profiles")
          .update({
            fitbit_access_token: refreshed.access_token,
            fitbit_refresh_token: refreshed.refresh_token,
            fitbit_token_expires_at: Math.floor(Date.now() / 1000) + (refreshed.expires_in || 28800),
          })
          .eq("id", user.id);
      } else {
        return NextResponse.json(
          { error: "Token expired. Please reconnect Fitbit.", needsReconnect: true },
          { status: 401 }
        );
      }
    }
  }

  const today = new Date().toISOString().substring(0, 10);
  const results = { activity: 0, heartRate: 0, sleep: 0, skipped: 0, errors: 0, tokenRefreshed };

  for (const date of dates) {
    const isToday = date === today;
    const staleMs = isToday ? STALE_TODAY_MS : STALE_PAST_MS;

    // Check if data is fresh enough
    const { data: existing } = await supabase
      .from("fitbit_daily_activity")
      .select("fetched_at")
      .eq("user_id", user.id)
      .eq("date", date)
      .maybeSingle();

    if (existing?.fetched_at) {
      const age = Date.now() - new Date(existing.fetched_at).getTime();
      if (age < staleMs) {
        results.skipped++;
        continue;
      }
    }

    try {
      // Fetch activity
      let activityData;
      try {
        activityData = await fitbitFetch(
          `/1/user/-/activities/date/${date}.json`,
          currentToken
        );
      } catch (err) {
        // If 401 and we haven't refreshed yet, try refreshing
        if ((err as Error & { status?: number }).status === 401 && !tokenRefreshed && refresh_token) {
          const refreshed = await refreshFitbitToken(refresh_token);
          if (refreshed.access_token) {
            currentToken = refreshed.access_token;
            tokenRefreshed = true;
            await supabase
              .from("profiles")
              .update({
                fitbit_access_token: refreshed.access_token,
                fitbit_refresh_token: refreshed.refresh_token,
                fitbit_token_expires_at: Math.floor(Date.now() / 1000) + (refreshed.expires_in || 28800),
              })
              .eq("id", user.id);
            // Retry with new token
            activityData = await fitbitFetch(
              `/1/user/-/activities/date/${date}.json`,
              currentToken
            );
          } else {
            return NextResponse.json(
              { error: "Token expired. Please reconnect Fitbit.", needsReconnect: true, ...results },
              { status: 401 }
            );
          }
        } else {
          throw err;
        }
      }

      const summary = activityData.summary || {};
      await supabase.from("fitbit_daily_activity").upsert(
        {
          user_id: user.id,
          date,
          steps: summary.steps || 0,
          calories_total: summary.caloriesOut || 0,
          calories_active: summary.activityCalories || 0,
          distance_km: (summary.distances?.find((d: { activity: string }) => d.activity === "total")?.distance || 0),
          floors: summary.floors || 0,
          active_minutes_very: summary.veryActiveMinutes || 0,
          active_minutes_fairly: summary.fairlyActiveMinutes || 0,
          active_minutes_lightly: summary.lightlyActiveMinutes || 0,
          sedentary_minutes: summary.sedentaryMinutes || 0,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "user_id,date" }
      );
      results.activity++;

      // Fetch heart rate
      try {
        const hrData = await fitbitFetch(
          `/1/user/-/activities/heart/date/${date}/1d.json`,
          currentToken
        );
        const hrSummary = hrData["activities-heart"]?.[0]?.value || {};
        const zones = hrSummary.heartRateZones || [];
        const getZone = (name: string) => zones.find((z: { name: string }) => z.name === name) || {};

        await supabase.from("fitbit_heart_rate").upsert(
          {
            user_id: user.id,
            date,
            resting_hr: hrSummary.restingHeartRate || null,
            out_of_range_minutes: getZone("Out of Range").minutes || 0,
            out_of_range_calories: getZone("Out of Range").caloriesOut || 0,
            fat_burn_minutes: getZone("Fat Burn").minutes || 0,
            fat_burn_calories: getZone("Fat Burn").caloriesOut || 0,
            cardio_minutes: getZone("Cardio").minutes || 0,
            cardio_calories: getZone("Cardio").caloriesOut || 0,
            peak_minutes: getZone("Peak").minutes || 0,
            peak_calories: getZone("Peak").caloriesOut || 0,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "user_id,date" }
        );
        results.heartRate++;
      } catch {
        // HR data might not be available
      }

      // Fetch sleep
      try {
        const sleepData = await fitbitFetch(
          `/1.2/user/-/sleep/date/${date}.json`,
          currentToken
        );
        const mainSleep = sleepData.sleep?.find((s: { isMainSleep: boolean }) => s.isMainSleep);
        if (mainSleep) {
          const stages = mainSleep.levels?.summary || {};
          await supabase.from("fitbit_sleep").upsert(
            {
              user_id: user.id,
              date,
              duration_minutes: Math.round((mainSleep.duration || 0) / 60000),
              efficiency: mainSleep.efficiency || 0,
              deep_minutes: stages.deep?.minutes || 0,
              light_minutes: stages.light?.minutes || 0,
              rem_minutes: stages.rem?.minutes || 0,
              wake_minutes: stages.wake?.minutes || 0,
              start_time: mainSleep.startTime?.substring(11, 16) || null,
              end_time: mainSleep.endTime?.substring(11, 16) || null,
              fetched_at: new Date().toISOString(),
            },
            { onConflict: "user_id,date" }
          );
          results.sleep++;
        }
      } catch {
        // Sleep data might not be available
      }
    } catch {
      results.errors++;
    }
  }

  return NextResponse.json(results);
}
