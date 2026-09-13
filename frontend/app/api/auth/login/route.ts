import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from "@/lib/auth";

interface LoginResponse {
  accessToken?: unknown;
  error?: unknown;
  user?: unknown;
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "A valid JSON request body is required." },
      { status: 400 },
    );
  }

  try {
    const { email, password, remember } = body as {
      email?: unknown;
      password?: unknown;
      remember?: unknown;
    };

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return NextResponse.json(
        { ok: false, error: "Email and password are required." },
        { status: 400 },
      );
    }

    const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:4000/v1";

    const backendResponse = await fetch(`${backendUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
      cache: "no-store",
    });

    const data = (await backendResponse
      .json()
      .catch(() => ({}))) as LoginResponse;

    if (!backendResponse.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            typeof data.error === "string"
              ? data.error
              : backendResponse.status === 401
                ? "Invalid credentials."
                : "Authentication failed.",
        },
        { status: backendResponse.status },
      );
    }

    const accessToken =
      typeof data.accessToken === "string" ? data.accessToken : null;

    if (!accessToken) {
      // Never log the complete response because it may contain tokens.
      console.error("Backend login succeeded without a valid access token");

      return NextResponse.json(
        { ok: false, error: "Invalid authentication response." },
        { status: 502 },
      );
    }

    const response = NextResponse.json({
      ok: true,
      user: data.user,
      returnTo: "/dashboard",
    });

    response.cookies.set(SESSION_COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      ...(remember === true ? { maxAge: SESSION_DURATION_SECONDS } : {}),
    });

    return response;
  } catch (error) {
    console.error(
      "Login proxy error:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return NextResponse.json(
      { ok: false, error: "Authentication service unavailable." },
      { status: 503 },
    );
  }
}
