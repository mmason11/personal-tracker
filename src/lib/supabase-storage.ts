import { createClient } from "@/lib/supabase/client";
import { BigThreeGoal, TodoItem, CustomEvent, RoutineOverride } from "./types";
import { v4 as uuidv4 } from "uuid";
import { startOfWeek, format } from "date-fns";

const supabase = createClient();

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// Big Three Goals
export function getCurrentWeekStart(): string {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export async function getBigThree(): Promise<BigThreeGoal[]> {
  const userId = await getUserId();
  const currentWeek = getCurrentWeekStart();
  const { data, error } = await supabase
    .from("big_three_goals")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", currentWeek)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    text: row.text,
    completed: row.completed,
    weekStart: row.week_start,
  }));
}

export async function addBigThreeGoal(text: string): Promise<BigThreeGoal[]> {
  const userId = await getUserId();
  const currentWeek = getCurrentWeekStart();
  const existing = await getBigThree();
  if (existing.length >= 3) return existing;

  const { error } = await supabase.from("big_three_goals").insert({
    id: uuidv4(),
    user_id: userId,
    text,
    completed: false,
    week_start: currentWeek,
  });
  if (error) throw error;
  return getBigThree();
}

export async function toggleBigThree(id: string): Promise<BigThreeGoal[]> {
  const goals = await getBigThree();
  const goal = goals.find((g) => g.id === id);
  if (!goal) return goals;

  const { error } = await supabase
    .from("big_three_goals")
    .update({ completed: !goal.completed })
    .eq("id", id);
  if (error) throw error;
  return getBigThree();
}

export async function removeBigThree(id: string): Promise<BigThreeGoal[]> {
  const { error } = await supabase
    .from("big_three_goals")
    .delete()
    .eq("id", id);
  if (error) throw error;
  return getBigThree();
}

// To-Do List
export async function getTodos(): Promise<TodoItem[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("todo_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    text: row.text,
    completed: row.completed,
    createdAt: row.created_at,
    dueDate: row.due_date || undefined,
    priority: row.priority,
  }));
}

export async function addTodo(
  text: string,
  priority: TodoItem["priority"] = "medium",
  dueDate?: string
): Promise<TodoItem[]> {
  const userId = await getUserId();
  const { error } = await supabase.from("todo_items").insert({
    id: uuidv4(),
    user_id: userId,
    text,
    completed: false,
    created_at: new Date().toISOString(),
    priority,
    due_date: dueDate || null,
  });
  if (error) throw error;
  return getTodos();
}

export async function toggleTodo(id: string): Promise<TodoItem[]> {
  const todos = await getTodos();
  const todo = todos.find((t) => t.id === id);
  if (!todo) return todos;

  const { error } = await supabase
    .from("todo_items")
    .update({ completed: !todo.completed })
    .eq("id", id);
  if (error) throw error;
  return getTodos();
}

export async function removeTodo(id: string): Promise<TodoItem[]> {
  const { error } = await supabase
    .from("todo_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
  return getTodos();
}

// Custom Events
export async function getCustomEvents(): Promise<CustomEvent[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("custom_events")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    date: row.date,
    start: row.start_time,
    end: row.end_time,
  }));
}

export async function getCustomEventsForDate(date: string): Promise<CustomEvent[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("custom_events")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .order("start_time", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    date: row.date,
    start: row.start_time,
    end: row.end_time,
  }));
}

export async function addCustomEvent(event: Omit<CustomEvent, "id">): Promise<CustomEvent[]> {
  const userId = await getUserId();
  const { error } = await supabase.from("custom_events").insert({
    id: uuidv4(),
    user_id: userId,
    name: event.name,
    date: event.date,
    start_time: event.start,
    end_time: event.end,
  });
  if (error) throw error;
  return getCustomEvents();
}

export async function updateCustomEvent(
  id: string,
  updates: Partial<CustomEvent>
): Promise<CustomEvent[]> {
  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.date !== undefined) updateData.date = updates.date;
  if (updates.start !== undefined) updateData.start_time = updates.start;
  if (updates.end !== undefined) updateData.end_time = updates.end;

  const { error } = await supabase
    .from("custom_events")
    .update(updateData)
    .eq("id", id);
  if (error) throw error;
  return getCustomEvents();
}

export async function removeCustomEvent(id: string): Promise<CustomEvent[]> {
  const { error } = await supabase
    .from("custom_events")
    .delete()
    .eq("id", id);
  if (error) throw error;
  return getCustomEvents();
}

// Routine Overrides
export async function getRoutineOverrides(): Promise<RoutineOverride[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("routine_overrides")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return (data || []).map((row) => ({
    routineId: row.routine_id,
    date: row.date,
    start: row.start_time,
    end: row.end_time,
  }));
}

export async function getOverrideForRoutine(
  routineId: string,
  date: string
): Promise<RoutineOverride | undefined> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("routine_overrides")
    .select("*")
    .eq("user_id", userId)
    .eq("routine_id", routineId)
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  return {
    routineId: data.routine_id,
    date: data.date,
    start: data.start_time,
    end: data.end_time,
  };
}

export async function setRoutineOverride(
  routineId: string,
  date: string,
  start: string,
  end: string
): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase
    .from("routine_overrides")
    .upsert(
      {
        user_id: userId,
        routine_id: routineId,
        date,
        start_time: start,
        end_time: end,
      },
      { onConflict: "user_id,routine_id,date" }
    );
  if (error) throw error;
}

export async function removeRoutineOverride(
  routineId: string,
  date: string
): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase
    .from("routine_overrides")
    .delete()
    .eq("user_id", userId)
    .eq("routine_id", routineId)
    .eq("date", date);
  if (error) throw error;
}

// Profile helpers (week1Start, tokens)
export async function getProfile(): Promise<Record<string, unknown> | null> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(updates: Record<string, unknown>): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);
  if (error) throw error;
}

export async function getWeek1Start(): Promise<string> {
  const profile = await getProfile();
  if (profile?.week1_start) return profile.week1_start as string;

  // Set it for the first time
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const iso = monday.toISOString();

  await updateProfile({ week1_start: iso });
  return iso;
}

export async function getGoogleTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  const profile = await getProfile();
  return {
    accessToken: (profile?.google_access_token as string) || null,
    refreshToken: (profile?.google_refresh_token as string) || null,
  };
}

export async function saveGoogleTokens(accessToken: string, refreshToken?: string): Promise<void> {
  const updates: Record<string, unknown> = { google_access_token: accessToken };
  if (refreshToken) updates.google_refresh_token = refreshToken;
  await updateProfile(updates);
}

export async function clearGoogleTokens(): Promise<void> {
  await updateProfile({ google_access_token: null, google_refresh_token: null });
}
