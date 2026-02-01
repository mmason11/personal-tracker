"use client";

import { FitbitHeartRate } from "@/hooks/useFitnessData";

interface Props {
  data: FitbitHeartRate[];
}

export default function HeartRateCard({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
        <h3 className="text-lg font-bold text-white mb-2">Heart Rate</h3>
        <p className="text-slate-500 text-sm">No heart rate data yet.</p>
      </div>
    );
  }

  const latest = data[data.length - 1];
  const avgResting = Math.round(
    data.filter((d) => d.resting_hr).reduce((sum, d) => sum + (d.resting_hr || 0), 0) /
    data.filter((d) => d.resting_hr).length || 0
  );

  const zones = [
    { name: "Fat Burn", minutes: latest.fat_burn_minutes, color: "bg-amber-400", textColor: "text-amber-400" },
    { name: "Cardio", minutes: latest.cardio_minutes, color: "bg-orange-400", textColor: "text-orange-400" },
    { name: "Peak", minutes: latest.peak_minutes, color: "bg-red-400", textColor: "text-red-400" },
  ];

  const totalZoneMin = zones.reduce((sum, z) => sum + z.minutes, 0) || 1;

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
      <h3 className="text-lg font-bold text-white mb-4">Heart Rate</h3>

      <div className="flex items-center gap-4 mb-5">
        <div className="text-center">
          <p className="text-3xl font-bold text-rose-400">
            {latest.resting_hr || "--"}
          </p>
          <p className="text-xs text-slate-500">Resting BPM</p>
        </div>
        {data.length > 1 && avgResting > 0 && (
          <div className="text-center">
            <p className="text-xl font-bold text-rose-300">{avgResting}</p>
            <p className="text-xs text-slate-500">Avg Resting</p>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 mb-2 font-medium">Zone Minutes (Latest Day)</p>
      <div className="space-y-2">
        {zones.map((zone) => (
          <div key={zone.name} className="flex items-center gap-3">
            <span className="text-xs text-slate-400 w-16">{zone.name}</span>
            <div className="flex-1 h-3 bg-slate-700/60 rounded-full overflow-hidden">
              <div
                className={`h-full ${zone.color} rounded-full transition-all`}
                style={{ width: `${Math.min((zone.minutes / totalZoneMin) * 100, 100)}%` }}
              />
            </div>
            <span className={`text-xs font-medium ${zone.textColor} w-10 text-right`}>
              {zone.minutes}m
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
