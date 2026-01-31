import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/?auth=error", request.url));
  }

  // Return an HTML page that sends the code to the parent window
  const html = `
    <!DOCTYPE html>
    <html>
      <head><title>Connecting...</title></head>
      <body>
        <p>Connecting to Google Calendar...</p>
        <script>
          const code = ${JSON.stringify(code)};
          if (window.opener) {
            window.opener.postMessage({ type: 'google-auth', code }, '*');
            window.close();
          } else {
            localStorage.setItem('google_auth_code', code);
            window.location.href = '/?auth=success';
          }
        </script>
      </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
