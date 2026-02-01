"use client";

import { useState, useEffect, useCallback } from "react";
import { format, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { getFitbitTokens } from "@/lib/fitbit";
import { getStravaTokens } from "@/lib/strava";

export type DateRange = "today" | "7days" | "30days";

export interface FitbitActivity {
  date: string;
  steps: number;
  calories_total: number;
  calories_active: number;
  distance_km: number;
  floors: number;
  active_minutes_very: number;
  active_minutes_fairly: number;
  active_minutes_lightly: number;
  sedentary_minutes: number;
}

export interface FitbitHeartRate {
  date: string;
  resting_hr: number | null;
  out_of_range_minutes: number;
  fat_burn_minutes: number;
  fat_burn_calories: number;
  cardio_minutes: number;
  cardio_calories: number;
  peak_minutes: number;
  peak_calories: number;
}

export interface FitbitSleep {
  date: string;
  duration_minutes: number;
  efficiency: number;
  deep_minutes: number;
  light_minutes: number;
  rem_minutes: number;
  wake_minutes: number;
  start_time: string | null;
  end_time: string | null;
}

export interface StravaActivity {
  strava_activity_id: number;
  name: string;
  type: string;
  start_date: string;
  distance_meters: number;
  moving_time_seconds: number;
  elapsed_time_seconds: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed: number;
  average_watts: number | null;
  max_watts: number | null;
  average_heartrate: number | null;
  max_heartrate: number | null;
  calories: number;
}

export function useFitnessData(range: DateRange) {
  const [activity, setActivity] = useState<FitbitActivity[]>([]);
  const [heartRate, setHeartRate] = useState<FitbitHeartRate[]>([]);
  const [sleep, setSleep] = useState<FitbitSleep[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [fitbitConnected, setFitbitConnected] = useState(false);
  const [stravaConnected, setStravaConnected] = useState(false);

  const supabase = createClient();

  const getDates = useCallback((): string[] => {
    const days = range === "today" ? 1 : range === "7days" ? 7 : 30;
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      dates.push(format(subDays(new Date(), i), "yyyy-MM-dd"));
    }
    return dates;
  }, [range]);

  const loadFromSupabase = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const dates = getDates();
    const startDate = dates[dates.length - 1];
    const endDate = dates[0];

    // Load activity data
    const { data: activityData } = await supabase
      .from("fitbit_daily_activity")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });
    setActivity(activityData || []);

    // Load heart rate data
    const { data: hrData } = await supabase
      .from("fitbit_heart_rate")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });
    setHeartRate(hrData || []);

    // Load sleep data
    const { data: sleepData } = await supabase
      .from("fitbit_sleep")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });
    setSleep(sleepData || []);

    // Load Strava activities
    const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const { data: stravaData } = await supabase
      .from("strava_activities")
      .select("*")
      .eq("user_id", user.id)
      .gte("start_date", `${thirtyDaysAgo}T00:00:00`)
      .order("start_date", { ascending: false })
      .limit(20);
    setStravaActivities(stravaData || []);

    setLoading(false);
  }, [supabase, getDates]);

  const syncFitbit = useCallback(async () => {
    const { accessToken } = await getFitbitTokens();
    if (!accessToken) return;

    setSyncing(true);
    try {
      const dates = getDates();
      await fetch("/api/fitbit/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken, dates }),
      });
      await loadFromSupabase();
    } catch (err) {
      console.error("Fitbit sync error:", err);
    }
    setSyncing(false);
  }, [getDates, loadFromSupabase]);

  const syncStrava = useCallback(async () => {
    const { accessToken, refreshToken, expiresAt } = await getStravaTokens();
    if (!accessToken || !refreshToken) return;

    setSyncing(true);
    try {
      const res = await fetch("/api/strava/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt,
        }),
      });
      const result = await res.json();
      if (result.error?.includes("expired") || result.error?.includes("reconnect")) {
        setStravaConnected(false);
      }
      await loadFromSupabase();
    } catch (err) {
      console.error("Strava sync error:", err);
    }
    setSyncing(false);
  }, [loadFromSupabase]);

  useEffect(() => {
    async function init() {
      const { accessToken } = await getFitbitTokens();
      setFitbitConnected(!!accessToken);

      const { accessToken: stravaToken } = await getStravaTokens();
      setStravaConnected(!!stravaToken);

      await loadFromSupabase();

      // Auto-sync if connected
      if (accessToken) syncFitbit();
      if (stravaToken) syncStrava();
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  return {
    activity,
    heartRate,
    sleep,
    stravaActivities,
    loading,
    syncing,
    fitbitConnected,
    stravaConnected,
    setFitbitConnected,
    setStravaConnected,
    syncFitbit,
    syncStrava,
    refresh: loadFromSupabase,
  };
}
