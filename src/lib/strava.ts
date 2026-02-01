import { createClient } from "@/lib/supabase/client";

export async function getStravaTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  athleteId: string | null;
  expiresAt: number | null;
}> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { accessToken: null, refreshToken: null, athleteId: null, expiresAt: null };

  const { data } = await supabase
    .from("profiles")
    .select("strava_access_token, strava_refresh_token, strava_athlete_id, strava_token_expires_at")
    .eq("id", user.id)
    .maybeSingle();

  return {
    accessToken: data?.strava_access_token || null,
    refreshToken: data?.strava_refresh_token || null,
    athleteId: data?.strava_athlete_id || null,
    expiresAt: data?.strava_token_expires_at || null,
  };
}

export async function saveStravaTokens(
  accessToken: string,
  refreshToken: string,
  athleteId: string,
  expiresAt: number
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({
      strava_access_token: accessToken,
      strava_refresh_token: refreshToken,
      strava_athlete_id: athleteId,
      strava_token_expires_at: expiresAt,
    })
    .eq("id", user.id);
}

export async function clearStravaTokens(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({
      strava_access_token: null,
      strava_refresh_token: null,
      strava_athlete_id: null,
      strava_token_expires_at: null,
    })
    .eq("id", user.id);
}
