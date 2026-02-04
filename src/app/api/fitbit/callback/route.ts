import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return new Response(
      `<html><body><script>
        window.opener?.postMessage({ type: "fitbit-auth", error: "${error || "no_code"}" }, "*");
        window.close();
      </script><p>Authorization failed. You can close this window.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const clientId = process.env.FITBIT_CLIENT_ID!;
  const clientSecret = process.env.FITBIT_CLIENT_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_URL}/api/fitbit/callback`;

  const tokenRes = await fetch("https://api.fitbit.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    return new Response(
      `<html><body><script>
        window.opener?.postMessage({ type: "fitbit-auth", error: "token_exchange_failed" }, "*");
        window.close();
      </script><p>Token exchange failed. You can close this window.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const expiresAt = Math.floor(Date.now() / 1000) + (tokenData.expires_in || 28800);

  return new Response(
    `<html><body><script>
      window.opener?.postMessage({
        type: "fitbit-auth",
        access_token: "${tokenData.access_token}",
        refresh_token: "${tokenData.refresh_token}",
        user_id: "${tokenData.user_id}",
        expires_at: ${expiresAt}
      }, "*");
      window.close();
    </script><p>Connected! You can close this window.</p></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

export async function POST(request: Request) {
  const { refresh_token } = await request.json();

  const clientId = process.env.FITBIT_CLIENT_ID!;
  const clientSecret = process.env.FITBIT_CLIENT_SECRET!;

  const tokenRes = await fetch("https://api.fitbit.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token,
    }),
  });

  const tokenData = await tokenRes.json();
  return NextResponse.json(tokenData);
}
