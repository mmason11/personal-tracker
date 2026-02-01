"use client";

import { FitbitActivity } from "@/hooks/useFitnessData";

interface Props {
  data: FitbitActivity[];
}

export default function ActivitySummary({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
        <h3 className="text-lg font-bold text-white mb-2">Activity</h3>
        <p className="text-slate-500 text-sm">No activity data yet. Connect Fitbit to get started.</p>
      </div>
    );
  }

  const latest = data[data.length - 1];
  const totalSteps = data.reduce((sum, d) => sum + d.steps, 0);
  const avgSteps = Math.round(totalSteps / data.length);
  const totalActiveMin = data.reduce(
    (sum, d) => sum + d.active_minutes_very + d.active_minutes_fairly,
    0
  );
  const totalCalories = data.reduce((sum, d) => sum + d.calories_active, 0);

  const stats = [
    {
      label: data.length === 1 ? "Steps" : "Avg Steps",
      value: data.length === 1 ? latest.steps.toLocaleString() : avgSteps.toLocaleString(),
      color: "text-emerald-400",
      icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
    },
    {
      label: data.length === 1 ? "Active Cal" : "Total Active Cal",
      value: data.length === 1 ? latest.calories_active.toLocaleString() : totalCalories.toLocaleString(),
      color: "text-amber-400",
      icon: "M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z",
    },
    {
      label: data.length === 1 ? "Active Min" : "Total Active Min",
      value: data.length === 1
        ? (latest.active_minutes_very + latest.active_minutes_fairly).toString()
        : totalActiveMin.toString(),
      color: "text-blue-400",
      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    {
      label: data.length === 1 ? "Distance" : "Total Distance",
      value: data.length === 1
        ? `${latest.distance_km.toFixed(1)} km`
        : `${data.reduce((s, d) => s + d.distance_km, 0).toFixed(1)} km`,
      color: "text-violet-400",
      icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
    },
  ];

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
      <h3 className="text-lg font-bold text-white mb-4">Activity</h3>
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-700/60 flex items-center justify-center flex-shrink-0">
              <svg className={`w-4 h-4 ${stat.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
              </svg>
            </div>
            <div>
              <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
      {latest.floors > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center gap-2">
          <span className="text-xs text-slate-500">Floors:</span>
          <span className="text-xs text-slate-300 font-medium">{latest.floors}</span>
        </div>
      )}
    </div>
  );
}
