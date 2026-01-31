"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { RoutineItem } from "@/lib/types";
import { getRoutineForDate, getCurrentWeek, getWakeUpTime } from "@/lib/routine";
import { toggleCompletion, isCompleted, calculateStreak } from "@/lib/streaks";

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

  const allComplete = routine.length > 0 && routine.every((r) => completions[r.id]);

  return (
    <div className="bg-slate-800 rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-white">Daily Routine</h2>
        {allComplete && (
          <span className="text-sm bg-green-500/20 text-green-400 px-3 py-1 rounded-full">
            All Done!
          </span>
        )}
      </div>
      <p className="text-sm text-slate-400 mb-4">
        Week {week}/5 &middot; Wake-up: {getWakeUpTime(week)} AM
      </p>

      <div className="space-y-3">
        {routine.map((item) => (
          <button
            key={item.id}
            onClick={() => handleToggle(item.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
              completions[item.id]
                ? "bg-green-500/10 border border-green-500/30"
                : "bg-slate-700/50 border border-slate-600/30 hover:bg-slate-700"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                completions[item.id]
                  ? "bg-green-500 border-green-500"
                  : "border-slate-500"
              }`}
            >
              {completions[item.id] && (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div className="flex-1 text-left">
              <span className={`font-medium ${completions[item.id] ? "text-green-400 line-through" : "text-white"}`}>
                {item.name}
              </span>
              <span className="text-slate-400 text-sm ml-2">
                {item.time}{item.endTime ? ` - ${item.endTime}` : ""}
              </span>
              {item.weekdaysOnly && (
                <span className="text-xs text-slate-500 ml-2">(weekdays)</span>
              )}
            </div>
            {(streaks[item.id] ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-amber-400 text-sm font-semibold">
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
