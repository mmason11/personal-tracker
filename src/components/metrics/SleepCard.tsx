"use client";

import { FitbitSleep } from "@/hooks/useFitnessData";

interface Props {
  data: FitbitSleep[];
}

export default function SleepCard({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
        <h3 className="text-lg font-bold text-white mb-2">Sleep</h3>
        <p className="text-slate-500 text-sm">No sleep data yet.</p>
      </div>
    );
  }

  const latest = data[data.length - 1];
  const hours = Math.floor(latest.duration_minutes / 60);
  const mins = latest.duration_minutes % 60;

  const avgDuration = Math.round(
    data.reduce((sum, d) => sum + d.duration_minutes, 0) / data.length
  );
  const avgHours = Math.floor(avgDuration / 60);
  const avgMins = avgDuration % 60;

  const stages = [
    { name: "Deep", minutes: latest.deep_minutes, color: "bg-indigo-500", textColor: "text-indigo-400" },
    { name: "REM", minutes: latest.rem_minutes, color: "bg-violet-500", textColor: "text-violet-400" },
    { name: "Light", minutes: latest.light_minutes, color: "bg-blue-400", textColor: "text-blue-400" },
    { name: "Awake", minutes: latest.wake_minutes, color: "bg-slate-400", textColor: "text-slate-400" },
  ];

  const totalStageMin = stages.reduce((sum, s) => sum + s.minutes, 0) || 1;

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
      <h3 className="text-lg font-bold text-white mb-4">Sleep</h3>

      <div className="flex items-center gap-4 mb-4">
        <div className="text-center">
          <p className="text-3xl font-bold text-violet-400">
            {hours}h {mins}m
          </p>
          <p className="text-xs text-slate-500">Last Night</p>
        </div>
        {data.length > 1 && (
          <div className="text-center">
            <p className="text-xl font-bold text-violet-300">
              {avgHours}h {avgMins}m
            </p>
            <p className="text-xs text-slate-500">Average</p>
          </div>
        )}
        <div className="text-center">
          <p className="text-lg font-bold text-emerald-400">
            {latest.efficiency}%
          </p>
          <p className="text-xs text-slate-500">Efficiency</p>
        </div>
      </div>

      {latest.start_time && latest.end_time && (
        <p className="text-xs text-slate-500 mb-3">
          {latest.start_time} - {latest.end_time}
        </p>
      )}

      <p className="text-xs text-slate-400 mb-2 font-medium">Sleep Stages</p>
      {/* Stacked bar */}
      <div className="flex h-4 rounded-full overflow-hidden mb-2">
        {stages.map((stage) => (
          <div
            key={stage.name}
            className={`${stage.color} transition-all`}
            style={{ width: `${(stage.minutes / totalStageMin) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex gap-4 flex-wrap">
        {stages.map((stage) => (
          <div key={stage.name} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${stage.color}`} />
            <span className={`text-xs ${stage.textColor}`}>
              {stage.name} {stage.minutes}m
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
