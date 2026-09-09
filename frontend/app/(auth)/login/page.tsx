'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('nfa_remember_email');
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanEmail = email.trim();

    setEmailError('');
    setPasswordError('');
    setAuthError('');

    let invalid = false;

    if (!cleanEmail) {
      setEmailError('Email is required.');
      invalid = true;
    } else if (!EMAIL_RE.test(cleanEmail)) {
      setEmailError('Enter a valid email address.');
      invalid = true;
    }

    if (!password) {
      setPasswordError('Password is required.');
      invalid = true;
    }

    if (invalid) return;

    if (remember) {
      localStorage.setItem('nfa_remember_email', cleanEmail);
    } else {
      localStorage.removeItem('nfa_remember_email');
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          remember,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setAuthError(data.error || 'Invalid credentials.');
        return;
      }

      router.replace(data.returnTo || '/dashboard');
      router.refresh();
    } catch {
      setAuthError('Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="nfaLogin">
      <section className="nfaBrand">
        <img
            src="/nfa_logo.png"
            alt="NFA Town & Regional Planners"
            className="nfaLogo"
        />

        <div className="brandCopy">
          <h1>
            Planning
            <br />
            for stronger
            <br />
            communities
          </h1>

          <div className="greenRule" />

          <p>
            Better data.
            <br />
            Smarter planning.
            <br />
            Sustainable places.
          </p>
        </div>

        <div className="brandTag">
          PLANNING. LAND.
          <br />
          SPATIAL INTELLIGENCE.
        </div>

        <div className="greenOrangeShape" />
        <div className="redShape" />
        <div className="blueShape" />
      </section>

      <section className="loginPanel">
        <div className="help">
          <a href="/contact">Need help?</a>
        </div>

        <div className="formArea">
          <div className="formBox">
            <h2>NFA Console</h2>

            <p className="intro">
              Sign in to access planning, land and
              <br />
              spatial-intelligence opportunities.
            </p>

            {authError && (
              <div className="authError">{authError}</div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor="email">Email</label>

              <div className="field">
                <span className="fieldIcon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 6l9 6 9-6M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError('');
                    setAuthError('');
                  }}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className={emailError ? 'errorInput' : ''}
                />
              </div>

              <div className="fieldError">
                {emailError || '\u00A0'}
              </div>

              <label htmlFor="password">Password</label>

              <div className="field">
                <span className="fieldIcon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <rect
                      x="5"
                      y="11"
                      width="14"
                      height="9"
                      rx="1.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M8 11V7a4 4 0 118 0v4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                  </svg>
                </span>

                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError('');
                    setAuthError('');
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className={passwordError ? 'errorInput' : ''}
                />

                <button
                  type="button"
                  className="eyeButton"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label="Toggle password visibility"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                  </svg>
                </button>
              </div>

              <div className="fieldError">
                {passwordError || '\u00A0'}
              </div>

              <div className="options">
                <label className="remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span>Remember me</span>
                </label>

                <a href="/forgot-password">
                  Forgot your password?
                </a>
              </div>

              <button
                className="signInButton"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>

        <footer className="loginFooter">
          <div>
            © 2026 NFA Town &amp; Regional Planners
            <br />
            Planning. Land. Spatial Intelligence.
          </div>

          <nav>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/contact">Contact</a>
          </nav>
        </footer>
      </section>
    </main>
  );
}
