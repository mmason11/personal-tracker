import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PELOTON_API = "https://api.onepeloton.com";

async function pelotonFetch(endpoint: string, sessionId: string) {
  const res = await fetch(`${PELOTON_API}${endpoint}`, {
    headers: {
      Cookie: `peloton_session_id=${sessionId}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Peloton API error: ${res.status}`);
  return res.json();
}

export async function POST(request: Request) {
  const { session_id, peloton_user_id, limit = 20 } = await request.json();

  if (!session_id || !peloton_user_id) {
    return NextResponse.json({ error: "Missing session_id or peloton_user_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Fetch recent workouts
    const workoutsData = await pelotonFetch(
      `/api/user/${peloton_user_id}/workouts?joins=ride,ride.instructor&limit=${limit}&page=0`,
      session_id
    );

    const workouts = workoutsData.data || [];
    let synced = 0;
    let errors = 0;

    for (const workout of workouts) {
      try {
        // Fetch performance data
        let perfData: Record<string, unknown> = {};
        try {
          perfData = await pelotonFetch(
            `/api/workout/${workout.id}/performance_graph?every_n=5`,
            session_id
          );
        } catch {
          // Performance data may not be available for all workout types
        }

        const ride = workout.ride || {};
        const instructor = ride.instructor || {};

        // Extract averages from performance data
        const summaries = (perfData.summaries as Array<{ slug: string; average: number }>) || [];
        const getAvg = (slug: string) =>
          summaries.find((s) => s.slug === slug)?.average || null;

        // Extract HR from metrics
        const metrics = (perfData.metrics as Array<{ slug: string; average_value: number; max_value: number }>) || [];
        const hrMetric = metrics.find((m) => m.slug === "heart_rate");

        await supabase.from("peloton_workouts").upsert(
          {
            user_id: user.id,
            peloton_workout_id: workout.id,
            started_at: workout.start_time
              ? new Date(workout.start_time * 1000).toISOString()
              : null,
            discipline: workout.fitness_discipline || null,
            duration_seconds: workout.ride?.duration || 0,
            title: ride.title || null,
            instructor: instructor.name || null,
            total_output: workout.total_work ? Math.round(workout.total_work / 1000) : null,
            avg_cadence: getAvg("avg_cadence"),
            avg_resistance: getAvg("avg_resistance"),
            avg_speed: getAvg("avg_speed"),
            avg_heart_rate: hrMetric?.average_value || null,
            max_heart_rate: hrMetric?.max_value || null,
            calories: workout.calories || 0,
            distance_miles: workout.distance
              ? Math.round(workout.distance * 100) / 100
              : null,
            is_pr: workout.is_total_work_personal_record || false,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "user_id,peloton_workout_id" }
        );
        synced++;
      } catch {
        errors++;
      }
    }

    return NextResponse.json({ synced, errors, total: workouts.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    if (message.includes("401") || message.includes("403")) {
      return NextResponse.json(
        { error: "Session expired. Please re-enter your credentials." },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
