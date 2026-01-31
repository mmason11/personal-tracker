"use client";

import { useState, useEffect } from "react";
import { BigThreeGoal } from "@/lib/types";
import {
  getBigThree,
  addBigThreeGoal,
  toggleBigThree,
  removeBigThree,
  getCurrentWeekStart,
} from "@/lib/storage";

export default function BigThree() {
  const [goals, setGoals] = useState<BigThreeGoal[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    setGoals(getBigThree());
  }, []);

  const handleAdd = () => {
    if (!newGoal.trim() || goals.length >= 3) return;
    setGoals(addBigThreeGoal(newGoal.trim()));
    setNewGoal("");
    setIsAdding(false);
  };

  const handleToggle = (id: string) => {
    setGoals(toggleBigThree(id));
  };

  const handleRemove = (id: string) => {
    setGoals(removeBigThree(id));
  };

  const weekStart = getCurrentWeekStart();
  const completedCount = goals.filter((g) => g.completed).length;

  return (
    <div className="bg-slate-800 rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-white">Big 3 Goals</h2>
        <span className="text-sm text-slate-400">
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
            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
              goal.completed
                ? "bg-green-500/10 border-green-500/30"
                : "bg-slate-700/50 border-slate-600/30"
            }`}
          >
            <button
              onClick={() => handleToggle(goal.id)}
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                goal.completed
                  ? "bg-green-500 border-green-500"
                  : "border-slate-500 hover:border-green-400"
              }`}
            >
              {goal.completed && (
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </button>
            <div className="flex-1">
              <span className="text-amber-400 font-bold text-sm mr-2">
                #{index + 1}
              </span>
              <span
                className={`${
                  goal.completed ? "text-green-400 line-through" : "text-white"
                }`}
              >
                {goal.text}
              </span>
            </div>
            <button
              onClick={() => handleRemove(goal.id)}
              className="text-slate-500 hover:text-red-400 transition-colors p-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
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
                className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <button
                onClick={handleAdd}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewGoal("");
                }}
                className="px-3 py-2.5 bg-slate-700 text-slate-400 rounded-xl hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full p-3 rounded-xl border-2 border-dashed border-slate-600 text-slate-400 hover:border-blue-500 hover:text-blue-400 transition-all"
            >
              + Add Goal ({3 - goals.length} remaining)
            </button>
          ))}
      </div>
    </div>
  );
}
