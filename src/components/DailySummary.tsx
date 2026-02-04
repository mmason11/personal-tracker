"use client";

import { useState, useEffect, useCallback } from "react";
import { format, subDays } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { getDailyGoals } from "@/lib/routine";
import { toggleCompletion } from "@/lib/supabase-streaks";
import TrendChart from "@/components/metrics/TrendChart";

type SummaryRange = "7days" | "30days" | "monthly";

interface DayData {
  date: string;
  goals: Record<string, boolean>;
  goalsCompleted: number;
  goalCount: number;
  steps: number | null;
  calories: number | null;
  restingHr: number | null;
  sleepMinutes: number | null;
}

interface MonthData {
  month: string;
  days: number;
  avgGoalPct: number;
  avgSteps: number | null;
  avgCalories: number | null;
  avgRestingHr: number | null;
  avgSleepMinutes: number | null;
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

    // Fetch fitbit data in parallel
    const [{ data: activityData }, { data: hrData }, { data: sleepData }] =
      await Promise.all([
        supabase
          .from("fitbit_daily_activity")
          .select("date, steps, calories_total")
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
      ]);

    // Build lookup maps
    const activityMap = new Map(
      (activityData || []).map((a: { date: string; steps: number; calories_total: number }) => [a.date, a])
    );
    const hrMap = new Map(
      (hrData || []).map((h: { date: string; resting_hr: number | null }) => [h.date, h])
    );
    const sleepMap = new Map(
      (sleepData || []).map((s: { date: string; duration_minutes: number }) => [s.date, s])
    );

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
      const activity = activityMap.get(date) as { steps: number; calories_total: number } | undefined;
      const hr = hrMap.get(date) as { resting_hr: number | null } | undefined;
      const sleep = sleepMap.get(date) as { duration_minutes: number } | undefined;

      days.push({
        date,
        goals,
        goalsCompleted: completed,
        goalCount: GOAL_COUNT,
        steps: activity?.steps ?? null,
        calories: activity?.calories_total ?? null,
        restingHr: hr?.resting_hr ?? null,
        sleepMinutes: sleep?.duration_minutes ?? null,
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

  const daysWithSteps = dayData.filter((d) => d.steps !== null);
  const avgSteps =
    daysWithSteps.length > 0
      ? Math.round(daysWithSteps.reduce((s, d) => s + d.steps!, 0) / daysWithSteps.length)
      : null;

  const daysWithCals = dayData.filter((d) => d.calories !== null);
  const avgCals =
    daysWithCals.length > 0
      ? Math.round(daysWithCals.reduce((s, d) => s + d.calories!, 0) / daysWithCals.length)
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

  // Toggle a goal completion for a specific date
  const handleGoalToggle = async (date: string, routineId: string) => {
    await toggleCompletion(routineId, date);
    setDayData((prev) =>
      prev.map((d) => {
        if (d.date !== date) return d;
        const newGoals = { ...d.goals, [routineId]: !d.goals[routineId] };
        const newCompleted = Object.values(newGoals).filter(Boolean).length;
        return { ...d, goals: newGoals, goalsCompleted: newCompleted };
      })
    );
  };

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
        const withCals = days.filter((d) => d.calories !== null);
        const withHr = days.filter((d) => d.restingHr !== null);
        const withSleep = days.filter((d) => d.sleepMinutes !== null);
        const totalHit = days.reduce((s, d) => s + d.goalsCompleted, 0);
        const totalPossible = days.reduce((s, d) => s + d.goalCount, 0);
        return {
          month,
          days: days.length,
          avgGoalPct:
            totalPossible > 0 ? Math.round((totalHit / totalPossible) * 100) : 0,
          avgSteps:
            withSteps.length > 0
              ? Math.round(withSteps.reduce((s, d) => s + d.steps!, 0) / withSteps.length)
              : null,
          avgCalories:
            withCals.length > 0
              ? Math.round(withCals.reduce((s, d) => s + d.calories!, 0) / withCals.length)
              : null,
          avgRestingHr:
            withHr.length > 0
              ? Math.round(withHr.reduce((s, d) => s + d.restingHr!, 0) / withHr.length)
              : null,
          avgSleepMinutes:
            withSleep.length > 0
              ? Math.round(withSleep.reduce((s, d) => s + d.sleepMinutes!, 0) / withSleep.length)
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
  const calsTrend = [...dayData]
    .filter((d) => d.calories !== null)
    .reverse()
    .map((d) => ({ label: d.date.substring(5), value: d.calories! }));
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

  const goalColor = (pct: number) =>
    pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400";
  const stepsColor = (steps: number) =>
    steps >= 10000 ? "text-emerald-400" : steps >= 7000 ? "text-amber-400" : "text-red-400";
  const calsColor = (cals: number) =>
    cals >= 3500 ? "text-emerald-400" : cals >= 3000 ? "text-amber-400" : "text-red-400";
  const hrColor = (hr: number) =>
    hr <= 60 ? "text-emerald-400" : hr <= 72 ? "text-blue-400" : "text-amber-400";
  const sleepColor = (mins: number) =>
    mins >= 420 ? "text-emerald-400" : mins >= 360 ? "text-amber-400" : "text-red-400";

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
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Goal Completion</p>
              <p className={`text-2xl font-bold ${goalColor(goalPct)}`}>{goalPct}%</p>
              <p className="text-xs text-slate-500 mt-1">
                {totalGoalsHit}/{totalGoalsPossible} goals hit
              </p>
            </div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Avg Steps</p>
              <p className={`text-2xl font-bold ${avgSteps !== null ? stepsColor(avgSteps) : "text-slate-500"}`}>
                {avgSteps !== null ? avgSteps.toLocaleString() : "—"}
              </p>
              <p className="text-xs text-slate-500 mt-1">per day</p>
            </div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Avg Calories</p>
              <p className={`text-2xl font-bold ${avgCals !== null ? calsColor(avgCals) : "text-slate-500"}`}>
                {avgCals !== null ? avgCals.toLocaleString() : "—"}
              </p>
              <p className="text-xs text-slate-500 mt-1">per day</p>
            </div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Avg Resting HR</p>
              <p className={`text-2xl font-bold ${avgHr !== null ? hrColor(avgHr) : "text-slate-500"}`}>
                {avgHr !== null ? `${avgHr} bpm` : "—"}
              </p>
              <p className="text-xs text-slate-500 mt-1">beats per minute</p>
            </div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Avg Sleep</p>
              <p className={`text-2xl font-bold ${avgSleep !== null ? sleepColor(avgSleep) : "text-slate-500"}`}>
                {avgSleep !== null ? formatSleep(avgSleep) : "—"}
              </p>
              <p className="text-xs text-slate-500 mt-1">per night</p>
            </div>
          </div>

          {/* Streak & best day */}
          <div className="flex flex-wrap gap-4">
            {streak > 0 && (
              <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-xl px-4 py-3 border border-slate-700/50 flex items-center gap-2">
                <span className="text-emerald-400 text-lg">&#x1F525;</span>
                <span className="text-sm text-slate-300">
                  <span className="font-bold text-white">{streak}-day</span> perfect streak
                </span>
              </div>
            )}
            {bestDay && bestDay.goalsCompleted > 0 && (
              <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-xl px-4 py-3 border border-slate-700/50 flex items-center gap-2">
                <span className="text-amber-400 text-lg">&#x2B50;</span>
                <span className="text-sm text-slate-300">
                  Best day:{" "}
                  <span className="font-bold text-white">{formatDateLabel(bestDay.date)}</span>{" "}
                  ({bestDay.goalsCompleted}/{GOAL_COUNT})
                </span>
              </div>
            )}
          </div>

          {/* Day-by-day table or monthly averages */}
          {range === "monthly" ? (
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl shadow-lg border border-slate-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-5 py-3">Month</th>
                      <th className="text-center text-xs text-slate-400 uppercase tracking-wider px-4 py-3">Goals</th>
                      <th className="text-right text-xs text-slate-400 uppercase tracking-wider px-4 py-3">Avg Steps</th>
                      <th className="text-right text-xs text-slate-400 uppercase tracking-wider px-4 py-3">Avg Cals</th>
                      <th className="text-right text-xs text-slate-400 uppercase tracking-wider px-4 py-3">Avg HR</th>
                      <th className="text-right text-xs text-slate-400 uppercase tracking-wider px-5 py-3">Avg Sleep</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((m) => (
                      <tr key={m.month} className="border-b border-slate-700/30 last:border-0 hover:bg-slate-700/20 transition-colors">
                        <td className="px-5 py-3.5 text-white font-medium">{formatMonth(m.month)}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`font-semibold ${goalColor(m.avgGoalPct)}`}>{m.avgGoalPct}%</span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={m.avgSteps !== null ? stepsColor(m.avgSteps) : "text-slate-500"}>
                            {m.avgSteps !== null ? m.avgSteps.toLocaleString() : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={m.avgCalories !== null ? calsColor(m.avgCalories) : "text-slate-500"}>
                            {m.avgCalories !== null ? m.avgCalories.toLocaleString() : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={m.avgRestingHr !== null ? hrColor(m.avgRestingHr) : "text-slate-500"}>
                            {m.avgRestingHr !== null ? `${m.avgRestingHr} bpm` : "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={m.avgSleepMinutes !== null ? sleepColor(m.avgSleepMinutes) : "text-slate-500"}>
                            {m.avgSleepMinutes !== null ? formatSleep(m.avgSleepMinutes) : "—"}
                          </span>
                        </td>
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
                      <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-5 py-3">Date</th>
                      <th className="text-center text-xs text-slate-400 uppercase tracking-wider px-4 py-3">Goals</th>
                      <th className="text-right text-xs text-slate-400 uppercase tracking-wider px-4 py-3">Steps</th>
                      <th className="text-right text-xs text-slate-400 uppercase tracking-wider px-4 py-3">Calories</th>
                      <th className="text-right text-xs text-slate-400 uppercase tracking-wider px-4 py-3">Resting HR</th>
                      <th className="text-right text-xs text-slate-400 uppercase tracking-wider px-5 py-3">Sleep</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayData.map((d) => (
                      <tr key={d.date} className="border-b border-slate-700/30 last:border-0 hover:bg-slate-700/20 transition-colors">
                        <td className="px-5 py-3.5 text-white font-medium whitespace-nowrap">
                          {formatDateLabel(d.date)}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center gap-1.5">
                            {dailyGoals.map((g) => (
                              <button
                                key={g.routineId}
                                title={g.name}
                                onClick={() => handleGoalToggle(d.date, g.routineId)}
                                className={`w-3.5 h-3.5 rounded-full transition-colors cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-offset-slate-800 ${
                                  d.goals[g.routineId]
                                    ? "bg-emerald-400 hover:ring-emerald-400/50"
                                    : "bg-slate-600 hover:ring-slate-400/50"
                                }`}
                              />
                            ))}
                            <span className={`ml-2 text-xs font-medium ${goalColor((d.goalsCompleted / d.goalCount) * 100)}`}>
                              {d.goalsCompleted}/{d.goalCount}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={d.steps !== null ? stepsColor(d.steps) : "text-slate-500"}>
                            {d.steps !== null ? d.steps.toLocaleString() : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={d.calories !== null ? calsColor(d.calories) : "text-slate-500"}>
                            {d.calories !== null ? d.calories.toLocaleString() : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={d.restingHr !== null ? hrColor(d.restingHr) : "text-slate-500"}>
                            {d.restingHr !== null ? `${d.restingHr} bpm` : "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={d.sleepMinutes !== null ? sleepColor(d.sleepMinutes) : "text-slate-500"}>
                            {d.sleepMinutes !== null ? formatSleep(d.sleepMinutes) : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sparkline trends */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Goal Completion Trend</p>
              <TrendChart data={goalTrend} color="violet" unit="%" height={100} />
            </div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Steps Trend</p>
              <TrendChart data={stepsTrend} color="emerald" height={100} />
            </div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Calories Trend</p>
              <TrendChart data={calsTrend} color="rose" unit=" cal" height={100} />
            </div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Resting HR Trend</p>
              <TrendChart data={hrTrend} color="rose" unit=" bpm" height={100} />
            </div>
            <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Sleep Trend</p>
              <TrendChart data={sleepTrend} color="blue" unit="h" height={100} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
