import { createClient } from "@/lib/supabase/client";

const PELOTON_API = "https://api.onepeloton.com";

export async function getPelotonSession(): Promise<{
  sessionId: string | null;
  userId: string | null;
}> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { sessionId: null, userId: null };

  const { data } = await supabase
    .from("profiles")
    .select("peloton_session_id, peloton_user_id")
    .eq("id", user.id)
    .maybeSingle();

  return {
    sessionId: data?.peloton_session_id || null,
    userId: data?.peloton_user_id || null,
  };
}

export async function savePelotonSession(
  sessionId: string,
  pelotonUserId: string
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({
      peloton_session_id: sessionId,
      peloton_user_id: pelotonUserId,
    })
    .eq("id", user.id);
}

export async function clearPelotonSession(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({
      peloton_session_id: null,
      peloton_user_id: null,
    })
    .eq("id", user.id);
}

export async function pelotonApiFetch(
  endpoint: string,
  sessionId: string
): Promise<Response> {
  return fetch(`${PELOTON_API}${endpoint}`, {
    headers: {
      Cookie: `peloton_session_id=${sessionId}`,
      "Content-Type": "application/json",
    },
  });
}
