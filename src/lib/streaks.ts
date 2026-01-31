import { format, subDays, parseISO } from "date-fns";
import { Streak, RoutineCompletion } from "./types";

const STORAGE_KEY = "routine_completions";
const STREAK_KEY = "routine_streaks";

export function getCompletions(): RoutineCompletion[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveCompletions(completions: RoutineCompletion[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(completions));
}

export function toggleCompletion(routineId: string, date: string): RoutineCompletion[] {
  const completions = getCompletions();
  const existing = completions.find(
    (c) => c.routineId === routineId && c.date === date
  );

  if (existing) {
    existing.completed = !existing.completed;
  } else {
    completions.push({ routineId, date, completed: true });
  }

  saveCompletions(completions);
  return completions;
}

export function isCompleted(routineId: string, date: string): boolean {
  const completions = getCompletions();
  const c = completions.find(
    (c) => c.routineId === routineId && c.date === date
  );
  return c?.completed ?? false;
}

export function getStreaks(): Record<string, Streak> {
  if (typeof window === "undefined") return {};
  const stored = localStorage.getItem(STREAK_KEY);
  return stored ? JSON.parse(stored) : {};
}

export function calculateStreak(routineId: string): Streak {
  const completions = getCompletions().filter(
    (c) => c.routineId === routineId && c.completed
  );

  const dates = completions
    .map((c) => c.date)
    .sort()
    .reverse();

  let current = 0;
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");

  // Check if streak is still active (completed today or yesterday)
  if (dates.length > 0 && (dates[0] === today || dates[0] === yesterday)) {
    current = 1;
    for (let i = 1; i < dates.length; i++) {
      const expected = format(
        subDays(parseISO(dates[0]), i),
        "yyyy-MM-dd"
      );
      if (dates[i] === expected) {
        current++;
      } else {
        break;
      }
    }
  }

  const streaks = getStreaks();
  const prev = streaks[routineId];
  const best = Math.max(current, prev?.best ?? 0);

  const streak: Streak = {
    routineId,
    current,
    best,
    lastCompleted: dates[0] || "",
  };

  streaks[routineId] = streak;
  localStorage.setItem(STREAK_KEY, JSON.stringify(streaks));

  return streak;
}
