import { createClient } from "@/lib/supabase/client";
import { format, subDays, parseISO } from "date-fns";
import { Streak, RoutineCompletion } from "./types";

const supabase = createClient();

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

export async function getCompletions(): Promise<RoutineCompletion[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("routine_completions")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return (data || []).map((row) => ({
    routineId: row.routine_id,
    date: row.date,
    completed: row.completed,
  }));
}

export async function toggleCompletion(
  routineId: string,
  date: string
): Promise<RoutineCompletion[]> {
  const userId = await getUserId();

  // Check if exists
  const { data: existing } = await supabase
    .from("routine_completions")
    .select("*")
    .eq("user_id", userId)
    .eq("routine_id", routineId)
    .eq("date", date)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("routine_completions")
      .update({ completed: !existing.completed })
      .eq("user_id", userId)
      .eq("routine_id", routineId)
      .eq("date", date);
  } else {
    await supabase.from("routine_completions").insert({
      user_id: userId,
      routine_id: routineId,
      date,
      completed: true,
    });
  }

  // Recalculate streak after toggling
  await calculateStreak(routineId);

  return getCompletions();
}

export async function isCompleted(
  routineId: string,
  date: string
): Promise<boolean> {
  const userId = await getUserId();
  const { data } = await supabase
    .from("routine_completions")
    .select("completed")
    .eq("user_id", userId)
    .eq("routine_id", routineId)
    .eq("date", date)
    .maybeSingle();
  return data?.completed ?? false;
}

export async function getStreaks(): Promise<Record<string, Streak>> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("routine_streaks")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;

  const result: Record<string, Streak> = {};
  (data || []).forEach((row) => {
    result[row.routine_id] = {
      routineId: row.routine_id,
      current: row.current_streak,
      best: row.best_streak,
      lastCompleted: row.last_completed || "",
    };
  });
  return result;
}

export async function calculateStreak(routineId: string): Promise<Streak> {
  const userId = await getUserId();

  // Get all completed dates for this routine
  const { data: completions } = await supabase
    .from("routine_completions")
    .select("date")
    .eq("user_id", userId)
    .eq("routine_id", routineId)
    .eq("completed", true)
    .order("date", { ascending: false });

  const dates = (completions || []).map((c) => c.date);

  let current = 0;
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");

  if (dates.length > 0 && (dates[0] === today || dates[0] === yesterday)) {
    current = 1;
    for (let i = 1; i < dates.length; i++) {
      const expected = format(subDays(parseISO(dates[0]), i), "yyyy-MM-dd");
      if (dates[i] === expected) {
        current++;
      } else {
        break;
      }
    }
  }

  // Get previous best
  const { data: existingStreak } = await supabase
    .from("routine_streaks")
    .select("best_streak")
    .eq("user_id", userId)
    .eq("routine_id", routineId)
    .maybeSingle();

  const best = Math.max(current, existingStreak?.best_streak ?? 0);

  // Upsert streak
  await supabase.from("routine_streaks").upsert(
    {
      user_id: userId,
      routine_id: routineId,
      current_streak: current,
      best_streak: best,
      last_completed: dates[0] || null,
    },
    { onConflict: "user_id,routine_id" }
  );

  return {
    routineId,
    current,
    best,
    lastCompleted: dates[0] || "",
  };
}
