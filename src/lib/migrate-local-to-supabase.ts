import { createClient } from "@/lib/supabase/client";
import { v4 as uuidv4 } from "uuid";

const MIGRATION_FLAG = "supabase_migration_complete";

export async function migrateLocalStorageToSupabase(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const userId = user.id;

  try {
    // Migrate week1Start to profile
    const week1Start = localStorage.getItem("week1Start");
    if (week1Start) {
      await supabase
        .from("profiles")
        .update({ week1_start: week1Start })
        .eq("id", userId);
    }

    // Migrate Google tokens to profile
    const googleAccessToken = localStorage.getItem("google_access_token");
    const googleRefreshToken = localStorage.getItem("google_refresh_token");
    if (googleAccessToken) {
      const updates: Record<string, string> = { google_access_token: googleAccessToken };
      if (googleRefreshToken) updates.google_refresh_token = googleRefreshToken;
      await supabase.from("profiles").update(updates).eq("id", userId);
    }

    // Migrate Big Three Goals
    const bigThreeRaw = localStorage.getItem("big_three_goals");
    if (bigThreeRaw) {
      const goals = JSON.parse(bigThreeRaw);
      if (goals.length > 0) {
        const rows = goals.map((g: { id?: string; text: string; completed: boolean; weekStart: string }) => ({
          id: g.id || uuidv4(),
          user_id: userId,
          text: g.text,
          completed: g.completed,
          week_start: g.weekStart,
        }));
        await supabase.from("big_three_goals").upsert(rows, { onConflict: "id" });
      }
    }

    // Migrate Todos
    const todosRaw = localStorage.getItem("todo_items");
    if (todosRaw) {
      const todos = JSON.parse(todosRaw);
      if (todos.length > 0) {
        const rows = todos.map((t: { id?: string; text: string; completed: boolean; createdAt: string; priority: string; dueDate?: string }) => ({
          id: t.id || uuidv4(),
          user_id: userId,
          text: t.text,
          completed: t.completed,
          created_at: t.createdAt,
          priority: t.priority,
          due_date: t.dueDate || null,
        }));
        await supabase.from("todo_items").upsert(rows, { onConflict: "id" });
      }
    }

    // Migrate Custom Events
    const customEventsRaw = localStorage.getItem("custom_events");
    if (customEventsRaw) {
      const events = JSON.parse(customEventsRaw);
      if (events.length > 0) {
        const rows = events.map((e: { id?: string; name: string; date: string; start: string; end: string }) => ({
          id: e.id || uuidv4(),
          user_id: userId,
          name: e.name,
          date: e.date,
          start_time: e.start,
          end_time: e.end,
        }));
        await supabase.from("custom_events").upsert(rows, { onConflict: "id" });
      }
    }

    // Migrate Routine Overrides
    const overridesRaw = localStorage.getItem("routine_overrides");
    if (overridesRaw) {
      const overrides = JSON.parse(overridesRaw);
      if (overrides.length > 0) {
        const rows = overrides.map((o: { routineId: string; date: string; start: string; end: string }) => ({
          user_id: userId,
          routine_id: o.routineId,
          date: o.date,
          start_time: o.start,
          end_time: o.end,
        }));
        await supabase
          .from("routine_overrides")
          .upsert(rows, { onConflict: "user_id,routine_id,date" });
      }
    }

    // Migrate Routine Completions
    const completionsRaw = localStorage.getItem("routine_completions");
    if (completionsRaw) {
      const completions = JSON.parse(completionsRaw);
      if (completions.length > 0) {
        const rows = completions.map((c: { routineId: string; date: string; completed: boolean }) => ({
          user_id: userId,
          routine_id: c.routineId,
          date: c.date,
          completed: c.completed,
        }));
        await supabase
          .from("routine_completions")
          .upsert(rows, { onConflict: "user_id,routine_id,date" });
      }
    }

    // Migrate Streaks
    const streaksRaw = localStorage.getItem("routine_streaks");
    if (streaksRaw) {
      const streaks = JSON.parse(streaksRaw);
      const rows = Object.values(streaks).map((s: unknown) => {
        const streak = s as { routineId: string; current: number; best: number; lastCompleted: string };
        return {
          user_id: userId,
          routine_id: streak.routineId,
          current_streak: streak.current,
          best_streak: streak.best,
          last_completed: streak.lastCompleted || null,
        };
      });
      if (rows.length > 0) {
        await supabase
          .from("routine_streaks")
          .upsert(rows, { onConflict: "user_id,routine_id" });
      }
    }

    // Mark migration complete and clear localStorage
    localStorage.setItem(MIGRATION_FLAG, "true");

    // Clear migrated keys
    const keysToRemove = [
      "big_three_goals",
      "todo_items",
      "custom_events",
      "routine_overrides",
      "routine_completions",
      "routine_streaks",
      "week1Start",
      "sports_cache",
      "google_access_token",
      "google_refresh_token",
    ];
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    console.log("LocalStorage migration to Supabase complete.");
  } catch (err) {
    console.error("Migration error:", err);
    // Don't mark as complete so it retries next time
  }
}
