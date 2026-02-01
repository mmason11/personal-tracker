"use client";

import { PelotonWorkout } from "@/hooks/useFitnessData";
import { format } from "date-fns";

interface Props {
  data: PelotonWorkout[];
}

export default function PelotonCard({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
        <h3 className="text-lg font-bold text-white mb-2">Peloton Workouts</h3>
        <p className="text-slate-500 text-sm">No workout data yet. Connect Peloton to get started.</p>
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    return `${m} min`;
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Peloton Workouts</h3>
        <span className="text-xs font-semibold text-blue-400 bg-blue-500/15 px-2.5 py-1 rounded-full">
          {data.length} recent
        </span>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {data.slice(0, 10).map((workout) => (
          <div
            key={workout.peloton_workout_id}
            className="p-3.5 rounded-xl bg-slate-700/40 border border-slate-600/30"
          >
            <div className="flex items-start justify-between mb-1.5">
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">
                  {workout.title || workout.discipline}
                </p>
                <p className="text-xs text-slate-400">
                  {workout.instructor && `${workout.instructor} · `}
                  {formatDuration(workout.duration_seconds)}
                  {workout.started_at && ` · ${format(new Date(workout.started_at), "MMM d")}`}
                </p>
              </div>
              {workout.is_pr && (
                <span className="text-xs font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">
                  PR
                </span>
              )}
            </div>

            <div className="flex gap-3 flex-wrap mt-2">
              {workout.total_output != null && (
                <div className="text-center">
                  <p className="text-sm font-bold text-blue-400">{workout.total_output}</p>
                  <p className="text-[10px] text-slate-500">Output kJ</p>
                </div>
              )}
              {workout.calories > 0 && (
                <div className="text-center">
                  <p className="text-sm font-bold text-amber-400">{workout.calories}</p>
                  <p className="text-[10px] text-slate-500">Cal</p>
                </div>
              )}
              {workout.avg_cadence != null && (
                <div className="text-center">
                  <p className="text-sm font-bold text-emerald-400">{Math.round(workout.avg_cadence)}</p>
                  <p className="text-[10px] text-slate-500">Avg RPM</p>
                </div>
              )}
              {workout.avg_heart_rate != null && (
                <div className="text-center">
                  <p className="text-sm font-bold text-rose-400">{Math.round(workout.avg_heart_rate)}</p>
                  <p className="text-[10px] text-slate-500">Avg HR</p>
                </div>
              )}
              {workout.distance_miles != null && workout.distance_miles > 0 && (
                <div className="text-center">
                  <p className="text-sm font-bold text-violet-400">{workout.distance_miles.toFixed(1)}</p>
                  <p className="text-[10px] text-slate-500">Miles</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
