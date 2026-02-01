export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return new Response(
      `<html><body><script>
        window.opener?.postMessage({ type: "strava-auth", error: "${error || "no_code"}" }, "*");
        window.close();
      </script><p>Authorization failed. You can close this window.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const clientId = process.env.STRAVA_CLIENT_ID!;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET!;

  const tokenRes = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    return new Response(
      `<html><body><script>
        window.opener?.postMessage({ type: "strava-auth", error: "token_exchange_failed" }, "*");
        window.close();
      </script><p>Token exchange failed. You can close this window.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  return new Response(
    `<html><body><script>
      window.opener?.postMessage({
        type: "strava-auth",
        access_token: "${tokenData.access_token}",
        refresh_token: "${tokenData.refresh_token}",
        athlete_id: "${tokenData.athlete?.id || ""}",
        expires_at: ${tokenData.expires_at || 0}
      }, "*");
      window.close();
    </script><p>Connected! You can close this window.</p></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
