"use client";

import { StravaActivity } from "@/hooks/useFitnessData";
import { format } from "date-fns";

interface Props {
  data: StravaActivity[];
}

const typeIcons: Record<string, string> = {
  Ride: "🚴",
  Run: "🏃",
  Walk: "🚶",
  Swim: "🏊",
  Hike: "🥾",
  Yoga: "🧘",
  WeightTraining: "🏋️",
  Workout: "💪",
};

export default function StravaCard({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
        <h3 className="text-lg font-bold text-white mb-2">Strava Activities</h3>
        <p className="text-slate-500 text-sm">No activity data yet. Connect Strava to get started.</p>
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  };

  const metersToMiles = (m: number) => (m * 0.000621371).toFixed(1);

  const mpsToMph = (mps: number) => (mps * 2.23694).toFixed(1);

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Strava Activities</h3>
        <span className="text-xs font-semibold text-orange-400 bg-orange-500/15 px-2.5 py-1 rounded-full">
          {data.length} recent
        </span>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {data.slice(0, 10).map((activity) => (
          <div
            key={activity.strava_activity_id}
            className="p-3.5 rounded-xl bg-slate-700/40 border border-slate-600/30"
          >
            <div className="flex items-start justify-between mb-1.5">
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">
                  {activity.name || activity.type}
                </p>
                <p className="text-xs text-slate-400">
                  <span className="mr-1">{typeIcons[activity.type] || "🏅"}</span>
                  {activity.type}
                  {" · "}
                  {formatDuration(activity.moving_time_seconds)}
                  {activity.start_date && ` · ${format(new Date(activity.start_date), "MMM d")}`}
                </p>
              </div>
            </div>

            <div className="flex gap-3 flex-wrap mt-2">
              {activity.distance_meters > 0 && (
                <div className="text-center">
                  <p className="text-sm font-bold text-orange-400">{metersToMiles(activity.distance_meters)}</p>
                  <p className="text-[10px] text-slate-500">Miles</p>
                </div>
              )}
              {activity.average_speed > 0 && (
                <div className="text-center">
                  <p className="text-sm font-bold text-blue-400">{mpsToMph(activity.average_speed)}</p>
                  <p className="text-[10px] text-slate-500">Avg mph</p>
                </div>
              )}
              {activity.average_watts != null && (
                <div className="text-center">
                  <p className="text-sm font-bold text-amber-400">{Math.round(activity.average_watts)}</p>
                  <p className="text-[10px] text-slate-500">Avg W</p>
                </div>
              )}
              {activity.average_heartrate != null && (
                <div className="text-center">
                  <p className="text-sm font-bold text-rose-400">{Math.round(activity.average_heartrate)}</p>
                  <p className="text-[10px] text-slate-500">Avg HR</p>
                </div>
              )}
              {activity.total_elevation_gain > 0 && (
                <div className="text-center">
                  <p className="text-sm font-bold text-emerald-400">{Math.round(activity.total_elevation_gain * 3.28084)}</p>
                  <p className="text-[10px] text-slate-500">Elev ft</p>
                </div>
              )}
              {activity.calories > 0 && (
                <div className="text-center">
                  <p className="text-sm font-bold text-violet-400">{activity.calories}</p>
                  <p className="text-[10px] text-slate-500">Cal</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
