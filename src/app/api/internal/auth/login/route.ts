import { NextResponse, type NextRequest } from "next/server";
import { SignJWT } from "jose";
import { cookies } from "next/headers";

// In production, fetch user from database
const USERS = [
  {
    email: "admin@nfa.co.za",
    // password: "password123" (plaintext for demo, use bcrypt in real)
    passwordHash: "$2a$10$...", // you'd store bcrypt hash
  },
];

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password, remember } = body;

  // 1. Validate input
  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Email and password are required." },
      { status: 400 }
    );
  }

  // 2. Find user (replace with DB lookup)
  const user = USERS.find((u) => u.email === email);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Invalid email or password." },
      { status: 401 }
    );
  }

  // 3. Verify password (use bcrypt.compare in real app)
  const isValid = password === "password123"; // placeholder
  if (!isValid) {
    return NextResponse.json(
      { ok: false, error: "Invalid email or password." },
      { status: 401 }
    );
  }

  // 4. Create JWT (using jose)
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(remember ? "7d" : "1d")
    .sign(secret);

  // 5. Set httpOnly cookie
  const cookieStore = await cookies();
  cookieStore.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: remember ? 60 * 60 * 24 * 7 : 60 * 60 * 24,
    path: "/",
  });

  // 6. Return success with returnTo
  const returnTo = body.returnTo?.startsWith("/console/")
    ? body.returnTo
    : "/console/dashboard";
  return NextResponse.json({ ok: true, returnTo });
}
