import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import "./Login.css";

export const metadata: Metadata = {
  title: "Sign in — NFA Console",
};

export default function ConsoleLoginPage() {
  return (
    <main className="nfa-login-page">
      <section
        className="nfa-brand-panel"
        aria-label="NFA Town and Regional Planners"
      >
        <img
            className="nfa-logo"
            src="/nfa-logo.png"
            alt="NFA Town & Regional Planners"
            width="229"
            height="70"
        />

        <div className="nfa-brand-copy">
          <h1>
            Planning
            <br/>
            for stronger
            <br />
            communities
          </h1>

          <div className="nfa-accent-line" aria-hidden="true" />

          <p>
            Better data.
            <br />
            Smarter planning.
            <br />
            Sustainable places.
          </p>
        </div>

        <div className="nfa-brand-shapes" aria-hidden="true">
          <div className="nfa-shape nfa-shape-green" />
          <div className="nfa-shape nfa-shape-orange" />
          <div className="nfa-shape nfa-shape-red" />
          <div className="nfa-shape nfa-shape-blue" />
        </div>

      </section>

      <section className="nfa-auth-panel">

        <div className="nfa-auth-content">
          <header className="nfa-auth-header">
            <h2>NFA Console</h2>
            <p>
              Sign in to access planning, land and
              <br className="nfa-desktop-break" /> spatial-intelligence
              opportunities.
            </p>
          </header>

          <Suspense
            fallback={<div className="nfa-form-loading" aria-hidden="true" />}
          >
            <LoginForm />
          </Suspense>
        </div>

        <footer className="nfa-auth-footer">
          <p>
            © 2026 NFA Town &amp; Regional Planners
            <br />
            Planning. Land. Spatial Intelligence.
          </p>

          <nav aria-label="Legal">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/contact">Contact</a>
          </nav>
        </footer>
      </section>
    </main>
  );
}
