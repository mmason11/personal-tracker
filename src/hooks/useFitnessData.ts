"use client";

import { useState, useEffect, useCallback } from "react";
import { format, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { getFitbitTokens } from "@/lib/fitbit";
import { getPelotonSession } from "@/lib/peloton";

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

export interface PelotonWorkout {
  peloton_workout_id: string;
  started_at: string;
  discipline: string;
  duration_seconds: number;
  title: string;
  instructor: string;
  total_output: number | null;
  avg_cadence: number | null;
  avg_resistance: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  calories: number;
  distance_miles: number | null;
  is_pr: boolean;
}

export function useFitnessData(range: DateRange) {
  const [activity, setActivity] = useState<FitbitActivity[]>([]);
  const [heartRate, setHeartRate] = useState<FitbitHeartRate[]>([]);
  const [sleep, setSleep] = useState<FitbitSleep[]>([]);
  const [workouts, setWorkouts] = useState<PelotonWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [fitbitConnected, setFitbitConnected] = useState(false);
  const [pelotonConnected, setPelotonConnected] = useState(false);

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

    // Load Peloton workouts
    const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const { data: workoutData } = await supabase
      .from("peloton_workouts")
      .select("*")
      .eq("user_id", user.id)
      .gte("started_at", `${thirtyDaysAgo}T00:00:00`)
      .order("started_at", { ascending: false })
      .limit(20);
    setWorkouts(workoutData || []);

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

  const syncPeloton = useCallback(async () => {
    const { sessionId, userId: pelotonUserId } = await getPelotonSession();
    if (!sessionId || !pelotonUserId) return;

    setSyncing(true);
    try {
      const res = await fetch("/api/peloton/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          peloton_user_id: pelotonUserId,
        }),
      });
      const result = await res.json();
      if (result.error?.includes("Session expired")) {
        setPelotonConnected(false);
      }
      await loadFromSupabase();
    } catch (err) {
      console.error("Peloton sync error:", err);
    }
    setSyncing(false);
  }, [loadFromSupabase]);

  useEffect(() => {
    async function init() {
      const { accessToken } = await getFitbitTokens();
      setFitbitConnected(!!accessToken);

      const { sessionId } = await getPelotonSession();
      setPelotonConnected(!!sessionId);

      await loadFromSupabase();

      // Auto-sync if connected
      if (accessToken) syncFitbit();
      if (sessionId) syncPeloton();
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  return {
    activity,
    heartRate,
    sleep,
    workouts,
    loading,
    syncing,
    fitbitConnected,
    pelotonConnected,
    setFitbitConnected,
    setPelotonConnected,
    syncFitbit,
    syncPeloton,
    refresh: loadFromSupabase,
  };
}
