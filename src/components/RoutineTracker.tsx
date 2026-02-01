"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { getCurrentWeek, getWakeUpTime, getDailyGoals, DailyGoal } from "@/lib/routine";
import { toggleCompletion, isCompleted, calculateStreak } from "@/lib/supabase-streaks";
import { formatTime12h } from "@/lib/timeFormat";

export default function RoutineTracker() {
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [completions, setCompletions] = useState<Record<string, boolean>>({});
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [week, setWeek] = useState(1);
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    async function load() {
      const w = await getCurrentWeek();
      setWeek(w);
      const items = getDailyGoals();
      setGoals(items);

      const comps: Record<string, boolean> = {};
      const stks: Record<string, number> = {};
      for (const item of items) {
        comps[item.routineId] = await isCompleted(item.routineId, today);
        const s = await calculateStreak(item.routineId);
        stks[item.routineId] = s.current;
      }
      setCompletions(comps);
      setStreaks(stks);
    }
    load().catch(console.error);
  }, [today]);

  const handleToggle = async (routineId: string) => {
    await toggleCompletion(routineId, today);
    setCompletions((prev) => ({ ...prev, [routineId]: !prev[routineId] }));
    const streak = await calculateStreak(routineId);
    setStreaks((prev) => ({ ...prev, [routineId]: streak.current }));
  };

  const completedCount = goals.filter((g) => completions[g.routineId]).length;
  const allComplete = goals.length > 0 && completedCount === goals.length;
  const progress = goals.length > 0 ? (completedCount / goals.length) * 100 : 0;

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-white">Daily Goals</h2>
        {allComplete ? (
          <span className="text-sm font-bold bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30">
            All Done!
          </span>
        ) : (
          <span className="text-sm font-semibold text-violet-400 bg-violet-500/15 px-3 py-1 rounded-full">
            {completedCount}/{goals.length}
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
        {goals.map((goal) => (
          <button
            key={goal.id}
            onClick={() => handleToggle(goal.routineId)}
            className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all ${
              completions[goal.routineId]
                ? "bg-emerald-500/10 border border-emerald-500/30"
                : "bg-slate-700/40 border border-slate-600/30 hover:bg-slate-700/60 hover:border-slate-500/40"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                completions[goal.routineId]
                  ? "bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/30"
                  : "border-slate-500 hover:border-violet-400"
              }`}
            >
              {completions[goal.routineId] && (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div className="flex-1 text-left">
              <span className={`font-medium ${completions[goal.routineId] ? "text-emerald-300 line-through" : "text-white"}`}>
                {goal.name}
              </span>
            </div>
            {(streaks[goal.routineId] ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-amber-400 text-sm font-bold bg-amber-500/10 px-2.5 py-1 rounded-full">
                <span>🔥</span>
                <span>{streaks[goal.routineId]}</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
