import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in — NFA Console",
};

export default function ConsoleLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-950">NFA Console</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sign in to review planning, land and spatial-intelligence
          opportunities.
        </p>
        {/* useSearchParams in LoginForm requires a Suspense boundary. */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
