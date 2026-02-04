"use client";

import { useState, useEffect, useCallback } from "react";
import { format, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { getDailyGoals } from "@/lib/routine";
import TrendChart from "@/components/metrics/TrendChart";
import type { FitbitActivity, FitbitHeartRate, FitbitSleep } from "@/hooks/useFitnessData";

type SummaryRange = "7days" | "30days" | "monthly";

interface StravaDay {
  distance: number; // meters total
  calories: number;
  avgHr: number | null;
  activities: number;
}

interface DayData {
  date: string;
  goals: Record<string, boolean>;
  goalsCompleted: number;
  goalCount: number;
  // Fitbit
  steps: number | null;
  restingHr: number | null;
  sleepMinutes: number | null;
  // Strava
  strava: StravaDay | null;
}

interface MonthData {
  month: string;
  days: number;
  avgGoalPct: number;
  avgSteps: number | null;
  avgRestingHr: number | null;
  avgSleepMinutes: number | null;
  avgStravaDistance: number | null;
  avgStravaCals: number | null;
  avgStravaHr: number | null;
}

const dailyGoals = getDailyGoals();
const GOAL_COUNT = dailyGoals.length;

export default function DailySummary() {
  const [range, setRange] = useState<SummaryRange>("7days");
  const [dayData, setDayData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const numDays = range === "monthly" ? 90 : range === "30days" ? 30 : 7;
    const endDate = format(new Date(), "yyyy-MM-dd");
    const startDate = format(subDays(new Date(), numDays - 1), "yyyy-MM-dd");

    // Fetch routine completions
    const { data: completions } = await supabase
      .from("routine_completions")
      .select("routine_id, date, completed")
      .eq("user_id", user.id)
      .in(
        "routine_id",
        dailyGoals.map((g) => g.routineId)
      )
      .gte("date", startDate)
      .lte("date", endDate);

    // Fetch fitbit data + strava activities in parallel
    const [
      { data: activityData },
      { data: hrData },
      { data: sleepData },
      { data: stravaData },
    ] = await Promise.all([
      supabase
        .from("fitbit_daily_activity")
        .select("date, steps")
        .eq("user_id", user.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true }),
      supabase
        .from("fitbit_heart_rate")
        .select("date, resting_hr")
        .eq("user_id", user.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true }),
      supabase
        .from("fitbit_sleep")
        .select("date, duration_minutes")
        .eq("user_id", user.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true }),
      supabase
        .from("strava_activities")
        .select("start_date, distance_meters, calories, average_heartrate")
        .eq("user_id", user.id)
        .gte("start_date", `${startDate}T00:00:00`)
        .lte("start_date", `${endDate}T23:59:59`)
        .order("start_date", { ascending: true }),
    ]);

    // Build Fitbit lookup maps
    const activityMap = new Map(
      (activityData || []).map((a: Pick<FitbitActivity, "date" | "steps">) => [a.date, a])
    );
    const hrMap = new Map(
      (hrData || []).map((h: Pick<FitbitHeartRate, "date" | "resting_hr">) => [h.date, h])
    );
    const sleepMap = new Map(
      (sleepData || []).map((s: Pick<FitbitSleep, "date" | "duration_minutes">) => [s.date, s])
    );

    // Build Strava daily aggregation map
    const stravaMap = new Map<string, StravaDay>();
    for (const s of stravaData || []) {
      const date = (s.start_date as string).substring(0, 10); // yyyy-MM-dd
      const existing = stravaMap.get(date);
      if (existing) {
        existing.distance += s.distance_meters || 0;
        existing.calories += s.calories || 0;
        existing.activities++;
        if (s.average_heartrate) {
          if (existing.avgHr !== null) {
            // Running average
            existing.avgHr =
              (existing.avgHr * (existing.activities - 1) + s.average_heartrate) /
              existing.activities;
          } else {
            existing.avgHr = s.average_heartrate;
          }
        }
      } else {
        stravaMap.set(date, {
          distance: s.distance_meters || 0,
          calories: s.calories || 0,
          avgHr: s.average_heartrate || null,
          activities: 1,
        });
      }
    }

    // Build completion map: date -> routineId -> completed
    const completionMap = new Map<string, Record<string, boolean>>();
    for (const c of completions || []) {
      if (!completionMap.has(c.date)) {
        completionMap.set(c.date, {});
      }
      completionMap.get(c.date)![c.routine_id] = c.completed;
    }

    // Build day-by-day data
    const days: DayData[] = [];
    for (let i = 0; i < numDays; i++) {
      const date = format(subDays(new Date(), i), "yyyy-MM-dd");
      const goals: Record<string, boolean> = {};
      let completed = 0;
      for (const g of dailyGoals) {
        const done = completionMap.get(date)?.[g.routineId] ?? false;
        goals[g.routineId] = done;
        if (done) completed++;
      }
      const activity = activityMap.get(date);
      const hr = hrMap.get(date);
      const sleep = sleepMap.get(date);
      const strava = stravaMap.get(date) || null;

      days.push({
        date,
        goals,
        goalsCompleted: completed,
        goalCount: GOAL_COUNT,
        steps: activity ? (activity as Pick<FitbitActivity, "date" | "steps">).steps : null,
        restingHr: hr ? (hr as Pick<FitbitHeartRate, "date" | "resting_hr">).resting_hr : null,
        sleepMinutes: sleep
          ? (sleep as Pick<FitbitSleep, "date" | "duration_minutes">).duration_minutes
          : null,
        strava,
      });
    }

    setDayData(days);
    setLoading(false);
  }, [supabase, range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute aggregate stats
  const daysWithGoals = dayData.filter((d) => d.goalCount > 0);
  const totalGoalsHit = daysWithGoals.reduce((s, d) => s + d.goalsCompleted, 0);
  const totalGoalsPossible = daysWithGoals.reduce((s, d) => s + d.goalCount, 0);
  const goalPct =
    totalGoalsPossible > 0 ? Math.round((totalGoalsHit / totalGoalsPossible) * 100) : 0;

  // Fitbit aggregates
  const daysWithSteps = dayData.filter((d) => d.steps !== null);
  const avgSteps =
    daysWithSteps.length > 0
      ? Math.round(daysWithSteps.reduce((s, d) => s + d.steps!, 0) / daysWithSteps.length)
      : null;

  const daysWithHr = dayData.filter((d) => d.restingHr !== null);
  const avgHr =
    daysWithHr.length > 0
      ? Math.round(daysWithHr.reduce((s, d) => s + d.restingHr!, 0) / daysWithHr.length)
      : null;

  const daysWithSleep = dayData.filter((d) => d.sleepMinutes !== null);
  const avgSleep =
    daysWithSleep.length > 0
      ? Math.round(
          daysWithSleep.reduce((s, d) => s + d.sleepMinutes!, 0) / daysWithSleep.length
        )
      : null;

  // Strava aggregates
  const daysWithStrava = dayData.filter((d) => d.strava !== null);
  const avgStravaDistance =
    daysWithStrava.length > 0
      ? daysWithStrava.reduce((s, d) => s + d.strava!.distance, 0) / daysWithStrava.length
      : null;
  const avgStravaCals =
    daysWithStrava.length > 0
      ? Math.round(
          daysWithStrava.reduce((s, d) => s + d.strava!.calories, 0) / daysWithStrava.length
        )
      : null;
  const daysWithStravaHr = dayData.filter(
    (d) => d.strava !== null && d.strava.avgHr !== null
  );
  const avgStravaHr =
    daysWithStravaHr.length > 0
      ? Math.round(
          daysWithStravaHr.reduce((s, d) => s + d.strava!.avgHr!, 0) / daysWithStravaHr.length
        )
      : null;

  const hasAnyFitbit = avgSteps !== null || avgHr !== null || avgSleep !== null;
  const hasAnyStrava = daysWithStrava.length > 0;

  // Best day (most goals completed)
  const bestDay =
    dayData.length > 0
      ? dayData.reduce(
          (best, d) => (d.goalsCompleted > best.goalsCompleted ? d : best),
          dayData[0]
        )
      : null;

  // Current streak
  let streak = 0;
  for (const d of dayData) {
    if (d.goalsCompleted === GOAL_COUNT) streak++;
    else break;
  }

  // Monthly aggregation
  const monthlyData: MonthData[] = (() => {
    if (range !== "monthly") return [];
    const monthMap = new Map<string, DayData[]>();
    for (const d of dayData) {
      const month = d.date.substring(0, 7);
      if (!monthMap.has(month)) monthMap.set(month, []);
      monthMap.get(month)!.push(d);
    }
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, days]) => {
        const withSteps = days.filter((d) => d.steps !== null);
        const withHr = days.filter((d) => d.restingHr !== null);
        const withSleep = days.filter((d) => d.sleepMinutes !== null);
        const withStrava = days.filter((d) => d.strava !== null);
        const withStravaHr = days.filter(
          (d) => d.strava !== null && d.strava.avgHr !== null
        );
        const totalHit = days.reduce((s, d) => s + d.goalsCompleted, 0);
        const totalPossible = days.reduce((s, d) => s + d.goalCount, 0);
        return {
          month,
          days: days.length,
          avgGoalPct:
            totalPossible > 0 ? Math.round((totalHit / totalPossible) * 100) : 0,
          avgSteps:
            withSteps.length > 0
              ? Math.round(
                  withSteps.reduce((s, d) => s + d.steps!, 0) / withSteps.length
                )
              : null,
          avgRestingHr:
            withHr.length > 0
              ? Math.round(
                  withHr.reduce((s, d) => s + d.restingHr!, 0) / withHr.length
                )
              : null,
          avgSleepMinutes:
            withSleep.length > 0
              ? Math.round(
                  withSleep.reduce((s, d) => s + d.sleepMinutes!, 0) / withSleep.length
                )
              : null,
          avgStravaDistance:
            withStrava.length > 0
              ? withStrava.reduce((s, d) => s + d.strava!.distance, 0) /
                withStrava.length
              : null,
          avgStravaCals:
            withStrava.length > 0
              ? Math.round(
                  withStrava.reduce((s, d) => s + d.strava!.calories, 0) /
                    withStrava.length
                )
              : null,
          avgStravaHr:
            withStravaHr.length > 0
              ? Math.round(
                  withStravaHr.reduce((s, d) => s + d.strava!.avgHr!, 0) /
                    withStravaHr.length
                )
              : null,
        };
      });
  })();

  // Sparkline data (reverse so oldest is first)
  const goalTrend = [...dayData].reverse().map((d) => ({
    label: d.date.substring(5),
    value: Math.round((d.goalsCompleted / d.goalCount) * 100),
  }));
  const stepsTrend = [...dayData]
    .filter((d) => d.steps !== null)
    .reverse()
    .map((d) => ({ label: d.date.substring(5), value: d.steps! }));
  const hrTrend = [...dayData]
    .filter((d) => d.restingHr !== null)
    .reverse()
    .map((d) => ({ label: d.date.substring(5), value: d.restingHr! }));
  const sleepTrend = [...dayData]
    .filter((d) => d.sleepMinutes !== null)
    .reverse()
    .map((d) => ({
      label: d.date.substring(5),
      value: Math.round((d.sleepMinutes! / 60) * 10) / 10,
    }));
  const stravaDistTrend = [...dayData]
    .filter((d) => d.strava !== null)
    .reverse()
    .map((d) => ({
      label: d.date.substring(5),
      value: Math.round((d.strava!.distance / 1609.34) * 10) / 10,
    }));
  const stravaCalsTrend = [...dayData]
    .filter((d) => d.strava !== null)
    .reverse()
    .map((d) => ({ label: d.date.substring(5), value: d.strava!.calories }));

  const rangeOptions: { id: SummaryRange; label: string }[] = [
    { id: "7days", label: "7 Days" },
    { id: "30days", label: "30 Days" },
    { id: "monthly", label: "Monthly Avg" },
  ];

  const formatSleep = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return format(d, "EEE, MMM d");
  };

  const formatMonth = (monthStr: string) => {
    const d = new Date(monthStr + "-01T12:00:00");
    return format(d, "MMMM yyyy");
  };

  const formatMiles = (meters: number) => {
    const miles = meters / 1609.34;
    return miles >= 10 ? `${Math.round(miles)} mi` : `${miles.toFixed(1)} mi`;
  };

  const goalColor = (pct: number) =>
    pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400";
  const stepsColor = (steps: number) =>
    steps >= 10000
      ? "text-emerald-400"
      : steps >= 7000
        ? "text-amber-400"
        : "text-red-400";
  const hrColor = (hr: number) =>
    hr <= 60
      ? "text-emerald-400"
      : hr <= 72
        ? "text-blue-400"
        : "text-amber-400";
  const sleepColor = (mins: number) =>
    mins >= 420
      ? "text-emerald-400"
      : mins >= 360
        ? "text-amber-400"
        : "text-red-400";
  const distColor = (meters: number) => {
    const miles = meters / 1609.34;
    return miles >= 5
      ? "text-emerald-400"
      : miles >= 2
        ? "text-amber-400"
        : "text-slate-300";
  };
  const calsColor = (cals: number) =>
    cals >= 500
      ? "text-emerald-400"
      : cals >= 200
        ? "text-amber-400"
        : "text-slate-300";

  return (
    <div className="space-y-6">
      {/* Header with range selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-bold text-white">Daily Summary</h2>
        <div className="flex gap-1 bg-slate-800/60 rounded-xl p-1 border border-slate-700/50">
          {rangeOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setRange(opt.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                range === opt.id
                  ? "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-slate-400">Loading summary...</div>
        </div>
      ) : (
        <>
          {/* Aggregate stats header */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                Goal Completion
              </p>
              <p className={`text-2xl font-bold ${goalColor(goalPct)}`}>
                {goalPct}%
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {totalGoalsHit}/{totalGoalsPossible} goals hit
              </p>
            </div>
            {hasAnyFitbit ? (
              <>
                <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                    Avg Steps
                  </p>
                  <p
                    className={`text-2xl font-bold ${avgSteps !== null ? stepsColor(avgSteps) : "text-slate-500"}`}
                  >
                    {avgSteps !== null ? avgSteps.toLocaleString() : "—"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">per day</p>
                </div>
                <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                    Avg Resting HR
                  </p>
                  <p
                    className={`text-2xl font-bold ${avgHr !== null ? hrColor(avgHr) : "text-slate-500"}`}
                  >
                    {avgHr !== null ? `${avgHr} bpm` : "—"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">beats per minute</p>
                </div>
                <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                    Avg Sleep
                  </p>
                  <p
                    className={`text-2xl font-bold ${avgSleep !== null ? sleepColor(avgSleep) : "text-slate-500"}`}
                  >
                    {avgSleep !== null ? formatSleep(avgSleep) : "—"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">per night</p>
                </div>
              </>
            ) : (
              <>
                <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                    Avg Distance
                  </p>
                  <p
                    className={`text-2xl font-bold ${avgStravaDistance !== null ? distColor(avgStravaDistance) : "text-slate-500"}`}
                  >
                    {avgStravaDistance !== null ? formatMiles(avgStravaDistance) : "—"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">per active day</p>
                </div>
                <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                    Avg Workout HR
                  </p>
                  <p
                    className={`text-2xl font-bold ${avgStravaHr !== null ? hrColor(avgStravaHr) : "text-slate-500"}`}
                  >
                    {avgStravaHr !== null ? `${avgStravaHr} bpm` : "—"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">during activities</p>
                </div>
                <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                    Avg Calories
                  </p>
                  <p
                    className={`text-2xl font-bold ${avgStravaCals !== null ? calsColor(avgStravaCals) : "text-slate-500"}`}
                  >
                    {avgStravaCals !== null ? avgStravaCals.toLocaleString() : "—"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">per active day</p>
                </div>
              </>
            )}
          </div>

          {/* Strava summary row when Fitbit is also present */}
          {hasAnyFitbit && hasAnyStrava && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-orange-900/20 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-orange-700/30">
                <p className="text-xs text-orange-400 uppercase tracking-wider mb-1">
                  Strava Distance
                </p>
                <p
                  className={`text-2xl font-bold ${avgStravaDistance !== null ? distColor(avgStravaDistance) : "text-slate-500"}`}
                >
                  {avgStravaDistance !== null ? formatMiles(avgStravaDistance) : "—"}
                </p>
                <p className="text-xs text-slate-500 mt-1">avg per active day</p>
              </div>
              <div className="bg-gradient-to-br from-orange-900/20 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-orange-700/30">
                <p className="text-xs text-orange-400 uppercase tracking-wider mb-1">
                  Workout HR
                </p>
                <p
                  className={`text-2xl font-bold ${avgStravaHr !== null ? hrColor(avgStravaHr) : "text-slate-500"}`}
                >
                  {avgStravaHr !== null ? `${avgStravaHr} bpm` : "—"}
                </p>
                <p className="text-xs text-slate-500 mt-1">avg during activities</p>
              </div>
              <div className="bg-gradient-to-br from-orange-900/20 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-orange-700/30">
                <p className="text-xs text-orange-400 uppercase tracking-wider mb-1">
                  Strava Calories
                </p>
                <p
                  className={`text-2xl font-bold ${avgStravaCals !== null ? calsColor(avgStravaCals) : "text-slate-500"}`}
                >
                  {avgStravaCals !== null ? avgStravaCals.toLocaleString() : "—"}
                </p>
                <p className="text-xs text-slate-500 mt-1">avg per active day</p>
              </div>
            </div>
          )}

          {/* Streak & best day */}
          <div className="flex flex-wrap gap-4">
            {streak > 0 && (
              <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-xl px-4 py-3 border border-slate-700/50 flex items-center gap-2">
                <span className="text-emerald-400 text-lg">&#x1F525;</span>
                <span className="text-sm text-slate-300">
                  <span className="font-bold text-white">{streak}-day</span> perfect
                  streak
                </span>
              </div>
            )}
            {bestDay && bestDay.goalsCompleted > 0 && (
              <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-xl px-4 py-3 border border-slate-700/50 flex items-center gap-2">
                <span className="text-amber-400 text-lg">&#x2B50;</span>
                <span className="text-sm text-slate-300">
                  Best day:{" "}
                  <span className="font-bold text-white">
                    {formatDateLabel(bestDay.date)}
                  </span>{" "}
                  ({bestDay.goalsCompleted}/{GOAL_COUNT})
                </span>
              </div>
            )}
          </div>

          {/* Sparkline trends */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                Goal Completion Trend
              </p>
              <TrendChart data={goalTrend} color="violet" unit="%" height={100} />
            </div>
            {hasAnyFitbit && (
              <>
                <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                    Steps Trend
                  </p>
                  <TrendChart
                    data={stepsTrend}
                    color="emerald"
                    height={100}
                  />
                </div>
                <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                    Resting HR Trend
                  </p>
                  <TrendChart
                    data={hrTrend}
                    color="rose"
                    unit=" bpm"
                    height={100}
                  />
                </div>
                <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                    Sleep Trend
                  </p>
                  <TrendChart
                    data={sleepTrend}
                    color="blue"
                    unit="h"
                    height={100}
                  />
                </div>
              </>
            )}
            {hasAnyStrava && (
              <>
                <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-orange-700/30">
                  <p className="text-xs text-orange-400 uppercase tracking-wider mb-2">
                    Strava Distance Trend
                  </p>
                  <TrendChart
                    data={stravaDistTrend}
                    color="emerald"
                    unit=" mi"
                    height={100}
                  />
                </div>
                <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-orange-700/30">
                  <p className="text-xs text-orange-400 uppercase tracking-wider mb-2">
                    Strava Calories Trend
                  </p>
                  <TrendChart
                    data={stravaCalsTrend}
                    color="rose"
                    unit=" cal"
                    height={100}
                  />
                </div>
              </>
            )}
          </div>

          {/* Day-by-day table or monthly averages */}
          {range === "monthly" ? (
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl shadow-lg border border-slate-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-5 py-3">
                        Month
                      </th>
                      <th className="text-center text-xs text-slate-400 uppercase tracking-wider px-4 py-3">
                        Goals
                      </th>
                      {hasAnyFitbit && (
                        <>
                          <th className="text-right text-xs text-slate-400 uppercase tracking-wider px-4 py-3">
                            Avg Steps
                          </th>
                          <th className="text-right text-xs text-slate-400 uppercase tracking-wider px-4 py-3">
                            Avg HR
                          </th>
                          <th className="text-right text-xs text-slate-400 uppercase tracking-wider px-4 py-3">
                            Avg Sleep
                          </th>
                        </>
                      )}
                      {hasAnyStrava && (
                        <>
                          <th className="text-right text-xs text-orange-400 uppercase tracking-wider px-4 py-3">
                            Distance
                          </th>
                          <th className="text-right text-xs text-orange-400 uppercase tracking-wider px-4 py-3">
                            Workout HR
                          </th>
                          <th className="text-right text-xs text-orange-400 uppercase tracking-wider px-4 py-3">
                            Calories
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((m) => (
                      <tr
                        key={m.month}
                        className="border-b border-slate-700/30 last:border-0 hover:bg-slate-700/20 transition-colors"
                      >
                        <td className="px-5 py-3.5 text-white font-medium">
                          {formatMonth(m.month)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`font-semibold ${goalColor(m.avgGoalPct)}`}
                          >
                            {m.avgGoalPct}%
                          </span>
                        </td>
                        {hasAnyFitbit && (
                          <>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className={
                                  m.avgSteps !== null
                                    ? stepsColor(m.avgSteps)
                                    : "text-slate-500"
                                }
                              >
                                {m.avgSteps !== null
                                  ? m.avgSteps.toLocaleString()
                                  : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className={
                                  m.avgRestingHr !== null
                                    ? hrColor(m.avgRestingHr)
                                    : "text-slate-500"
                                }
                              >
                                {m.avgRestingHr !== null
                                  ? `${m.avgRestingHr} bpm`
                                  : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className={
                                  m.avgSleepMinutes !== null
                                    ? sleepColor(m.avgSleepMinutes)
                                    : "text-slate-500"
                                }
                              >
                                {m.avgSleepMinutes !== null
                                  ? formatSleep(m.avgSleepMinutes)
                                  : "—"}
                              </span>
                            </td>
                          </>
                        )}
                        {hasAnyStrava && (
                          <>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className={
                                  m.avgStravaDistance !== null
                                    ? distColor(m.avgStravaDistance)
                                    : "text-slate-500"
                                }
                              >
                                {m.avgStravaDistance !== null
                                  ? formatMiles(m.avgStravaDistance)
                                  : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className={
                                  m.avgStravaHr !== null
                                    ? hrColor(m.avgStravaHr)
                                    : "text-slate-500"
                                }
                              >
                                {m.avgStravaHr !== null
                                  ? `${m.avgStravaHr} bpm`
                                  : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className={
                                  m.avgStravaCals !== null
                                    ? calsColor(m.avgStravaCals)
                                    : "text-slate-500"
                                }
                              >
                                {m.avgStravaCals !== null
                                  ? m.avgStravaCals.toLocaleString()
                                  : "—"}
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl shadow-lg border border-slate-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-5 py-3">
                        Date
                      </th>
                      <th className="text-center text-xs text-slate-400 uppercase tracking-wider px-4 py-3">
                        Goals
                      </th>
                      {hasAnyFitbit && (
                        <>
                          <th className="text-right text-xs text-slate-400 uppercase tracking-wider px-4 py-3">
                            Steps
                          </th>
                          <th className="text-right text-xs text-slate-400 uppercase tracking-wider px-4 py-3">
                            Resting HR
                          </th>
                          <th className="text-right text-xs text-slate-400 uppercase tracking-wider px-4 py-3">
                            Sleep
                          </th>
                        </>
                      )}
                      {hasAnyStrava && (
                        <>
                          <th className="text-right text-xs text-orange-400 uppercase tracking-wider px-4 py-3">
                            Distance
                          </th>
                          <th className="text-right text-xs text-orange-400 uppercase tracking-wider px-4 py-3">
                            Workout HR
                          </th>
                          <th className="text-right text-xs text-orange-400 uppercase tracking-wider px-4 py-3">
                            Calories
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {dayData.map((d) => (
                      <tr
                        key={d.date}
                        className="border-b border-slate-700/30 last:border-0 hover:bg-slate-700/20 transition-colors"
                      >
                        <td className="px-5 py-3.5 text-white font-medium whitespace-nowrap">
                          {formatDateLabel(d.date)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center gap-1.5">
                            {dailyGoals.map((g) => (
                              <div
                                key={g.routineId}
                                title={g.name}
                                className={`w-3 h-3 rounded-full ${
                                  d.goals[g.routineId]
                                    ? "bg-emerald-400"
                                    : "bg-slate-600"
                                }`}
                              />
                            ))}
                            <span
                              className={`ml-2 text-xs font-medium ${goalColor((d.goalsCompleted / d.goalCount) * 100)}`}
                            >
                              {d.goalsCompleted}/{d.goalCount}
                            </span>
                          </div>
                        </td>
                        {hasAnyFitbit && (
                          <>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className={
                                  d.steps !== null
                                    ? stepsColor(d.steps)
                                    : "text-slate-500"
                                }
                              >
                                {d.steps !== null
                                  ? d.steps.toLocaleString()
                                  : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className={
                                  d.restingHr !== null
                                    ? hrColor(d.restingHr)
                                    : "text-slate-500"
                                }
                              >
                                {d.restingHr !== null
                                  ? `${d.restingHr} bpm`
                                  : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className={
                                  d.sleepMinutes !== null
                                    ? sleepColor(d.sleepMinutes)
                                    : "text-slate-500"
                                }
                              >
                                {d.sleepMinutes !== null
                                  ? formatSleep(d.sleepMinutes)
                                  : "—"}
                              </span>
                            </td>
                          </>
                        )}
                        {hasAnyStrava && (
                          <>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className={
                                  d.strava
                                    ? distColor(d.strava.distance)
                                    : "text-slate-500"
                                }
                              >
                                {d.strava
                                  ? formatMiles(d.strava.distance)
                                  : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className={
                                  d.strava?.avgHr
                                    ? hrColor(d.strava.avgHr)
                                    : "text-slate-500"
                                }
                              >
                                {d.strava?.avgHr
                                  ? `${Math.round(d.strava.avgHr)} bpm`
                                  : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className={
                                  d.strava
                                    ? calsColor(d.strava.calories)
                                    : "text-slate-500"
                                }
                              >
                                {d.strava
                                  ? d.strava.calories.toLocaleString()
                                  : "—"}
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
