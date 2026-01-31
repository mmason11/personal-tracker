"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { RoutineItem } from "@/lib/types";
import { getRoutineForDate, getCurrentWeek, getWakeUpTime } from "@/lib/routine";
import { toggleCompletion, isCompleted, calculateStreak } from "@/lib/streaks";
import { formatTime12h } from "@/lib/timeFormat";

export default function RoutineTracker() {
  const [routine, setRoutine] = useState<RoutineItem[]>([]);
  const [completions, setCompletions] = useState<Record<string, boolean>>({});
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [week, setWeek] = useState(1);
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    const w = getCurrentWeek();
    setWeek(w);
    const items = getRoutineForDate(new Date(), w);
    setRoutine(items);

    const comps: Record<string, boolean> = {};
    const stks: Record<string, number> = {};
    items.forEach((item) => {
      comps[item.id] = isCompleted(item.id, today);
      stks[item.id] = calculateStreak(item.id).current;
    });
    setCompletions(comps);
    setStreaks(stks);
  }, [today]);

  const handleToggle = (routineId: string) => {
    toggleCompletion(routineId, today);
    setCompletions((prev) => ({ ...prev, [routineId]: !prev[routineId] }));
    const streak = calculateStreak(routineId);
    setStreaks((prev) => ({ ...prev, [routineId]: streak.current }));
  };

  const completedCount = routine.filter((r) => completions[r.id]).length;
  const allComplete = routine.length > 0 && completedCount === routine.length;
  const progress = routine.length > 0 ? (completedCount / routine.length) * 100 : 0;

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-white">Daily Routine</h2>
        {allComplete ? (
          <span className="text-sm font-bold bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">
            All Done!
          </span>
        ) : (
          <span className="text-sm font-semibold text-violet-400 bg-violet-500/15 px-3 py-1 rounded-full">
            {completedCount}/{routine.length}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-400 mb-3">
        Week {week}/5 &middot; Wake-up: {formatTime12h(getWakeUpTime(week))}
      </p>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-slate-700/60 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-2.5">
        {routine.map((item) => (
          <button
            key={item.id}
            onClick={() => handleToggle(item.id)}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all ${
              completions[item.id]
                ? "bg-emerald-500/10 border border-emerald-500/30"
                : "bg-slate-700/40 border border-slate-600/30 hover:bg-slate-700/60 hover:border-slate-500/40"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                completions[item.id]
                  ? "bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/30"
                  : "border-slate-500 hover:border-violet-400"
              }`}
            >
              {completions[item.id] && (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div className="flex-1 text-left">
              <span className={`font-medium ${completions[item.id] ? "text-emerald-300 line-through" : "text-white"}`}>
                {item.name}
              </span>
              <span className="text-slate-400 text-sm ml-2">
                {formatTime12h(item.time)}{item.endTime ? ` - ${formatTime12h(item.endTime)}` : ""}
              </span>
              {item.weekdaysOnly && (
                <span className="text-xs text-slate-500 ml-2">(weekdays)</span>
              )}
            </div>
            {(streaks[item.id] ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-amber-400 text-sm font-bold bg-amber-500/10 px-2.5 py-1 rounded-full">
                <span>🔥</span>
                <span>{streaks[item.id]}</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
