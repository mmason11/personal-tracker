import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.FITBIT_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Fitbit client ID not configured" }, { status: 500 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_URL}/api/fitbit/callback`;
  const scope = "activity heartrate sleep profile";

  const authUrl = new URL("https://www.fitbit.com/oauth2/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("expires_in", "604800");

  return NextResponse.json({ authUrl: authUrl.toString() });
}
