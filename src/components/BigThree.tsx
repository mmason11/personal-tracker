"use client";

import { useState, useEffect } from "react";
import { BigThreeGoal } from "@/lib/types";
import {
  getBigThree,
  addBigThreeGoal,
  toggleBigThree,
  removeBigThree,
  getCurrentWeekStart,
} from "@/lib/supabase-storage";

export default function BigThree() {
  const [goals, setGoals] = useState<BigThreeGoal[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    getBigThree().then(setGoals).catch(console.error);
  }, []);

  const handleAdd = async () => {
    if (!newGoal.trim() || goals.length >= 3) return;
    const updated = await addBigThreeGoal(newGoal.trim());
    setGoals(updated);
    setNewGoal("");
    setIsAdding(false);
  };

  const handleToggle = async (id: string) => {
    setGoals(await toggleBigThree(id));
  };

  const handleRemove = async (id: string) => {
    setGoals(await removeBigThree(id));
  };

  const weekStart = getCurrentWeekStart();
  const completedCount = goals.filter((g) => g.completed).length;

  const medalColors = [
    "from-amber-400 to-yellow-500",
    "from-slate-300 to-slate-400",
    "from-orange-400 to-amber-600",
  ];

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-800/80 rounded-2xl p-6 shadow-lg border border-slate-700/50">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-white">Big 3 Goals</h2>
        <span className="text-sm font-semibold text-amber-400 bg-amber-500/15 px-3 py-1 rounded-full">
          {completedCount}/{goals.length} done
        </span>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        Week of {weekStart} &middot; Resets Monday
      </p>

      <div className="space-y-3">
        {goals.map((goal, index) => (
          <div
            key={goal.id}
            className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
              goal.completed
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-slate-700/40 border-slate-600/30 hover:bg-slate-700/60"
            }`}
          >
            <button
              onClick={() => handleToggle(goal.id)}
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                goal.completed
                  ? "bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/30"
                  : "border-slate-500 hover:border-emerald-400"
              }`}
            >
              {goal.completed && (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <div className="flex-1">
              <span className={`text-sm font-bold mr-2 bg-gradient-to-r ${medalColors[index]} bg-clip-text text-transparent`}>
                #{index + 1}
              </span>
              <span className={`${goal.completed ? "text-emerald-300 line-through" : "text-white"}`}>
                {goal.text}
              </span>
            </div>
            <button
              onClick={() => handleRemove(goal.id)}
              className="text-slate-500 hover:text-red-400 transition-colors p-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        {goals.length < 3 &&
          (isAdding ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Enter a goal..."
                className="flex-1 bg-slate-700/60 border border-slate-600/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all"
                autoFocus
              />
              <button
                onClick={handleAdd}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:from-amber-400 hover:to-orange-400 transition-all font-semibold shadow-lg shadow-amber-500/20"
              >
                Add
              </button>
              <button
                onClick={() => { setIsAdding(false); setNewGoal(""); }}
                className="px-3 py-2.5 bg-slate-700 text-slate-400 rounded-xl hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full p-3.5 rounded-xl border-2 border-dashed border-slate-600/60 text-slate-400 hover:border-amber-500/50 hover:text-amber-400 transition-all"
            >
              + Add Goal ({3 - goals.length} remaining)
            </button>
          ))}
      </div>
    </div>
  );
}
