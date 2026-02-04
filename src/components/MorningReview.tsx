"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { format, subDays } from "date-fns";
import { getDailyGoals } from "@/lib/routine";
import { isCompleted, toggleCompletion } from "@/lib/supabase-streaks";
import { createClient } from "@/lib/supabase/client";

interface GoalState {
  id: string;
  name: string;
  routineId: string;
  completed: boolean;
  auto: boolean;
}

export default function MorningReview() {
  const [visible, setVisible] = useState(false);
  const [goals, setGoals] = useState<GoalState[]>([]);
  const [loading, setLoading] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);

  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
  const yesterdayDisplay = format(subDays(new Date(), 1), "EEEE, MMMM d");
  const dismissKey = `morning-review-dismissed-${yesterday}`;

  const loadGoals = useCallback(async () => {
    const dailyGoals = getDailyGoals();
    const supabase = createClient();

    // Check completion status for each goal
    const goalStates: GoalState[] = await Promise.all(
      dailyGoals.map(async (goal) => ({
        id: goal.id,
        name: goal.name,
        routineId: goal.routineId,
        completed: await isCompleted(goal.routineId, yesterday),
        auto: false,
      }))
    );

    // Query Strava activities for yesterday
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: activities } = await supabase
          .from("strava_activities")
          .select("start_date")
          .eq("user_id", user.id)
          .gte("start_date", `${yesterday}T00:00:00`)
          .lte("start_date", `${yesterday}T23:59:59`);

        if (activities && activities.length > 0) {
          for (const activity of activities) {
            // Parse the start_date and convert to Central Time hour
            const activityDate = new Date(activity.start_date);
            const centralHour = activityDate.toLocaleString("en-US", {
              timeZone: "America/Chicago",
              hour: "numeric",
              minute: "numeric",
              hour12: false,
            });
            const [hourStr, minStr] = centralHour.split(":");
            const totalMinutes = parseInt(hourStr) * 60 + parseInt(minStr);

            const morningIdx = goalStates.findIndex(
              (g) => g.routineId === "morning-workout"
            );
            const afternoonIdx = goalStates.findIndex(
              (g) => g.routineId === "workout"
            );

            if (totalMinutes < 12 * 60 + 30) {
              // Before 12:30 PM -> morning workout
              if (morningIdx !== -1 && !goalStates[morningIdx].completed) {
                await toggleCompletion("morning-workout", yesterday);
                goalStates[morningIdx].completed = true;
                goalStates[morningIdx].auto = true;
              } else if (morningIdx !== -1 && goalStates[morningIdx].completed) {
                goalStates[morningIdx].auto = true;
              }
            } else {
              // 12:30 PM or later -> afternoon workout
              if (afternoonIdx !== -1 && !goalStates[afternoonIdx].completed) {
                await toggleCompletion("workout", yesterday);
                goalStates[afternoonIdx].completed = true;
                goalStates[afternoonIdx].auto = true;
              } else if (afternoonIdx !== -1 && goalStates[afternoonIdx].completed) {
                goalStates[afternoonIdx].auto = true;
              }
            }
          }
        }
      }
    } catch {
      // Strava query failed, continue with manual-only goals
    }

    setGoals(goalStates);
    setLoading(false);

    // Show modal if any goals are not yet completed
    const hasIncomplete = goalStates.some((g) => !g.completed);
    if (hasIncomplete) {
      setVisible(true);
    }
  }, [yesterday]);

  useEffect(() => {
    // Check if already dismissed today
    if (localStorage.getItem(dismissKey)) {
      return;
    }
    loadGoals();
  }, [dismissKey, loadGoals]);

  useEffect(() => {
    if (!visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [visible]);

  const dismiss = () => {
    localStorage.setItem(dismissKey, "true");
    setVisible(false);
  };

  const handleToggle = async (index: number) => {
    const goal = goals[index];
    await toggleCompletion(goal.routineId, yesterday);
    setGoals((prev) =>
      prev.map((g, i) =>
        i === index ? { ...g, completed: !g.completed } : g
      )
    );
  };

  if (!visible || loading) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) dismiss();
      }}
    >
      <div className="bg-slate-800 rounded-2xl border border-slate-700/50 p-6 shadow-2xl w-full max-w-sm mx-4">
        <h3 className="text-lg font-bold text-white mb-1">
          Yesterday&apos;s Review
        </h3>
        <p className="text-sm text-slate-400 mb-4">{yesterdayDisplay}</p>

        <div className="space-y-2">
          {goals.map((goal, i) => (
            <button
              key={goal.id}
              onClick={() => handleToggle(i)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                goal.completed
                  ? "bg-emerald-500/10 border border-emerald-500/30"
                  : "bg-slate-700/40 border border-slate-600/50 hover:bg-slate-700/60"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${
                  goal.completed
                    ? "bg-emerald-500 text-white"
                    : "border-2 border-slate-500"
                }`}
              >
                {goal.completed && (
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
              <span
                className={`text-sm font-medium ${
                  goal.completed ? "text-emerald-300" : "text-slate-300"
                }`}
              >
                {goal.name}
              </span>
              {goal.auto && (
                <span className="text-xs text-violet-400 ml-auto">(auto)</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex justify-end mt-5">
          <button
            onClick={dismiss}
            className="text-sm font-semibold px-5 py-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg hover:from-violet-500 hover:to-blue-500 transition-all shadow-lg shadow-violet-500/20"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
