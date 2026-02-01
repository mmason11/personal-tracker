import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.onepeloton.com/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username_or_email: username,
        password,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.message || "Authentication failed" },
        { status: 401 }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      session_id: data.session_id,
      user_id: data.user_id,
    });
  } catch {
    return NextResponse.json({ error: "Failed to connect to Peloton" }, { status: 500 });
  }
}
