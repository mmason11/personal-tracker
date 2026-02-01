import { createClient } from "@/lib/supabase/client";

const FITBIT_API_BASE = "https://api.fitbit.com";

export async function getFitbitTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
}> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { accessToken: null, refreshToken: null, userId: null };

  const { data } = await supabase
    .from("profiles")
    .select("fitbit_access_token, fitbit_refresh_token, fitbit_user_id")
    .eq("id", user.id)
    .maybeSingle();

  return {
    accessToken: data?.fitbit_access_token || null,
    refreshToken: data?.fitbit_refresh_token || null,
    userId: data?.fitbit_user_id || null,
  };
}

export async function saveFitbitTokens(
  accessToken: string,
  refreshToken: string,
  fitbitUserId: string
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({
      fitbit_access_token: accessToken,
      fitbit_refresh_token: refreshToken,
      fitbit_user_id: fitbitUserId,
    })
    .eq("id", user.id);
}

export async function clearFitbitTokens(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({
      fitbit_access_token: null,
      fitbit_refresh_token: null,
      fitbit_user_id: null,
    })
    .eq("id", user.id);
}

export async function fitbitApiFetch(
  endpoint: string,
  accessToken: string
): Promise<Response> {
  return fetch(`${FITBIT_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function isFitbitConnected(accessToken: string | null): boolean {
  return !!accessToken;
}
