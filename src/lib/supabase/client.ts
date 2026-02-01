import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a dummy client during build/prerender when env vars aren't available.
    // It will never be used at runtime since the real vars will be set.
    return null as unknown as SupabaseClient;
  }

  client = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return client;
}
