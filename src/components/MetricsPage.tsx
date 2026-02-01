"use client";

import { useState } from "react";
import { useFitnessData, DateRange } from "@/hooks/useFitnessData";
import DateRangePicker from "./metrics/DateRangePicker";
import FitbitConnect from "./metrics/FitbitConnect";
import StravaConnect from "./metrics/StravaConnect";
import ActivitySummary from "./metrics/ActivitySummary";
import HeartRateCard from "./metrics/HeartRateCard";
import SleepCard from "./metrics/SleepCard";
import StravaCard from "./metrics/StravaCard";
import TrendChart from "./metrics/TrendChart";

export default function MetricsPage() {
  const [range, setRange] = useState<DateRange>("7days");
  const {
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
  } = useFitnessData(range);

  const stepsTrend = activity.map((d) => ({
    label: d.date.substring(5),
    value: d.steps,
  }));

  const hrTrend = heartRate
    .filter((d) => d.resting_hr)
    .map((d) => ({
      label: d.date.substring(5),
      value: d.resting_hr!,
    }));

  const sleepTrend = sleep.map((d) => ({
    label: d.date.substring(5),
    value: Math.round(d.duration_minutes / 60 * 10) / 10,
  }));

  return (
    <div className="space-y-6">
      {/* Header with date range picker */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-white">Metrics</h2>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {/* Connection cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FitbitConnect
          connected={fitbitConnected}
          onConnectionChange={setFitbitConnected}
          onSync={syncFitbit}
          syncing={syncing}
        />
        <StravaConnect
          connected={stravaConnected}
          onConnectionChange={setStravaConnected}
          onSync={syncStrava}
          syncing={syncing}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-slate-800 rounded-2xl p-6 border border-slate-700/50 animate-pulse">
              <div className="h-6 bg-slate-700 rounded w-24 mb-4" />
              <div className="h-20 bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Data cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ActivitySummary data={activity} />
            <HeartRateCard data={heartRate} />
            <SleepCard data={sleep} />
            <StravaCard data={stravaActivities} />
          </div>

          {/* Trend charts (only for 7+ days) */}
          {range !== "today" && (stepsTrend.length >= 2 || hrTrend.length >= 2 || sleepTrend.length >= 2) && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white">Trends</h3>

              {stepsTrend.length >= 2 && (
                <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
                  <p className="text-sm font-medium text-emerald-400 mb-3">Steps</p>
                  <TrendChart data={stepsTrend} color="emerald" />
                </div>
              )}

              {hrTrend.length >= 2 && (
                <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
                  <p className="text-sm font-medium text-rose-400 mb-3">Resting Heart Rate</p>
                  <TrendChart data={hrTrend} color="rose" unit=" bpm" />
                </div>
              )}

              {sleepTrend.length >= 2 && (
                <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-5 shadow-lg border border-slate-700/50">
                  <p className="text-sm font-medium text-violet-400 mb-3">Sleep Duration</p>
                  <TrendChart data={sleepTrend} color="violet" unit="h" />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
